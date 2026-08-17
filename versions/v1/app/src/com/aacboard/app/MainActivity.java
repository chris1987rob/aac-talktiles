package com.aacboard.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Thin WebView shell for the Talk Tiles board (assets/index.html).
 * Maps WebRTC permission requests (camera/mic) to Android runtime permissions,
 * granting the JS request only after the user approves on the system dialog.
 * Handles file chooser requests (<input type="file">) via system file picker.
 *
 * Board Lock (JS -> native bridge "TalkTiles"):
 *  - lock()   -> startLockTask() ONLY (self app-pinning; the system shows its
 *               own "App pinned" toast). Nothing else changes: system bars stay
 *               visible, the notification shade and home/back/recents gestures
 *               behave exactly as they normally would, and the whole board
 *               stays fully tappable.
 *  - unlock() -> stopLockTask().
 * No FLAG_SECURE, no immersive-sticky, no back consumption -- by explicit
 * request, the lock is a soft pin, not a kiosk trap.
 */
public class MainActivity extends Activity {
    private static final int REQ_MEDIA = 100;
    private static final int REQ_FILE_CHOOSER = 101;

    private WebView web;
    private PermissionRequest pendingRequest;
    private ValueCallback<Uri[]> uploadMessage;
    private volatile boolean boardLocked = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // No FLAG_SECURE: screenshots, recents previews and the notification
        // shade are deliberately left alone.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Remote debugging: lets adb-side tooling inspect the board. This app is
        // offline and personal; the visibility is worth more than the exposure.
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // IndexedDB persistence for tiles
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                android.util.Log.d("AAC_JS", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                android.util.Log.d("AAC_APP", "onPermissionRequest for: " + java.util.Arrays.toString(request.getResources()));
                List<String> needed = new ArrayList<>();
                for (String resource : request.getResources()) {
                    String perm = mapResource(resource);
                    if (perm != null && checkSelfPermission(perm)
                            != PackageManager.PERMISSION_GRANTED) {
                        needed.add(perm);
                    }
                }
                if (needed.isEmpty()) {
                    android.util.Log.d("AAC_APP", "Granting WebRTC permissions directly");
                    request.grant(request.getResources());
                } else {
                    android.util.Log.d("AAC_APP", "Requesting Android runtime permissions: " + needed);
                    pendingRequest = request;
                    requestPermissions(needed.toArray(new String[0]), REQ_MEDIA);
                }
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                android.util.Log.d("AAC_APP", "onPermissionRequestCanceled");
                if (pendingRequest == request) {
                    pendingRequest = null;
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                    WebChromeClient.FileChooserParams fileChooserParams) {
                android.util.Log.d("AAC_APP", "onShowFileChooser triggered");
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;

                Intent intent = null;
                if (fileChooserParams != null) {
                    try {
                        intent = fileChooserParams.createIntent();
                    } catch (Exception ignored) {
                    }
                }
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                }
                try {
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    try {
                        Intent fallbackIntent = new Intent(Intent.ACTION_GET_CONTENT);
                        fallbackIntent.addCategory(Intent.CATEGORY_OPENABLE);
                        fallbackIntent.setType("image/*");
                        startActivityForResult(fallbackIntent, REQ_FILE_CHOOSER);
                    } catch (Exception ex) {
                        if (uploadMessage != null) {
                            uploadMessage.onReceiveValue(null);
                            uploadMessage = null;
                        }
                        return false;
                    }
                }
                return true;
            }
        });

        // JS bridge: TalkTiles.lock() / TalkTiles.unlock() from the board.
        web.addJavascriptInterface(new TalkTilesBridge(), "TalkTiles");

        web.loadUrl("file:///android_asset/index.html");
    }

    /** JS-facing lock control. */
    private class TalkTilesBridge {
        @JavascriptInterface
        public void lock() {
            runOnUiThread(() -> setBoardLocked(true));
        }

        @JavascriptInterface
        public void unlock() {
            runOnUiThread(() -> setBoardLocked(false));
        }
    }

    /**
     * Soft pin only. The board itself is never disabled and no system UI is
     * touched -- the only thing that changes is Android's lock-task state.
     */
    private void setBoardLocked(boolean locked) {
        if (locked == boardLocked) return;
        boolean wasLocked = boardLocked;
        boardLocked = locked;
        if (Build.VERSION.SDK_INT >= 21) {
            try {
                if (locked && !wasLocked) {
                    startLockTask();
                    android.util.Log.d("AAC_APP", "Lock task mode started (app pinned)");
                } else if (!locked && wasLocked) {
                    stopLockTask();
                    android.util.Log.d("AAC_APP", "Lock task mode stopped");
                }
            } catch (Exception e) {
                // Self-pinning may be unavailable (e.g. App Pinning disabled in
                // Settings). Nothing else to fall back to -- and by request,
                // nothing else should be attempted.
                android.util.Log.w("AAC_APP", "lock task switch failed: " + e);
            }
        }
    }

    private static String mapResource(String resource) {
        if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            return Manifest.permission.CAMERA;
        }
        if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            return Manifest.permission.RECORD_AUDIO;
        }
        return null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MEDIA || pendingRequest == null) return;
        PermissionRequest req = pendingRequest;
        pendingRequest = null;

        if (grantResults.length == 0) {
            req.deny();
            return;
        }
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                req.deny();
                return;
            }
        }
        req.grant(req.getResources());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                if (results == null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        ClipData clipData = data.getClipData();
                        int count = clipData.getItemCount();
                        if (count > 0) {
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = clipData.getItemAt(i).getUri();
                            }
                        }
                    }
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        }
    }

    @Override
    public void onBackPressed() {
        // Back always behaves like normal Android, pinned or not.
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
