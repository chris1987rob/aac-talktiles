#!/usr/bin/env python3
"""Apply the modern-symbol-library edits to every index.html copy
(Android app + the two iPad copies). Each replacement must match exactly once
per file, so a drifted copy fails loudly instead of silently half-patching."""
import sys
FILES = [
    "/home/mike/aac-board/index.html",
    "/home/mike/aac-text-tiles-ipad/index.html",
    "/home/mike/aac-text-tiles-ipad/AACTextTilesiPad/www/index.html",
]

R = []  # (old, new)

# 1. Category chips: the five categories added yesterday had no chip.
R.append(("""            <button type="button" class="sym-cat-chip" data-cat="health" onclick="selectSymbolCategory('health')">🩺 Health (<span id="sym-count-health">0</span>)</button>
          </div>""",
"""            <button type="button" class="sym-cat-chip" data-cat="health" onclick="selectSymbolCategory('health')">🩺 Health (<span id="sym-count-health">0</span>)</button>
            <button type="button" class="sym-cat-chip" data-cat="vehicles" onclick="selectSymbolCategory('vehicles')">🚗 Vehicles (<span id="sym-count-vehicles">0</span>)</button>
            <button type="button" class="sym-cat-chip" data-cat="nature" onclick="selectSymbolCategory('nature')">🌤️ Nature (<span id="sym-count-nature">0</span>)</button>
            <button type="button" class="sym-cat-chip" data-cat="concepts" onclick="selectSymbolCategory('concepts')">🔢 Numbers (<span id="sym-count-concepts">0</span>)</button>
            <button type="button" class="sym-cat-chip" data-cat="colors" onclick="selectSymbolCategory('colors')">🎨 Colors (<span id="sym-count-colors">0</span>)</button>
            <button type="button" class="sym-cat-chip" data-cat="social" onclick="selectSymbolCategory('social')">💬 Social (<span id="sym-count-social">0</span>)</button>
          </div>"""))

# 2. Catalog build: carry the generated picture, and keep the library in
#    category order so the grouped "All" view gets one header per category.
R.append(("""          list.push({
            id: s.id,
            label: s.label,
            category: s.category || 'core',
            emoji: s.emoji || s.icon || '⭐',
            tts: s.tts || s.label,
            keywords: [s.label.toLowerCase(), s.id.replace(/_/g, ' '), ...(s.tags || [])]
          });
        });
      }""",
"""          list.push({
            id: s.id,
            label: s.label,
            category: s.category || 'core',
            emoji: s.emoji || s.icon || '⭐',
            img: s.img || null,
            tts: s.tts || s.label,
            keywords: [s.label.toLowerCase(), s.id.replace(/_/g, ' '), ...(s.tags || [])]
          });
        });
      }"""))
R.append(("""      AAC_SYMBOL_LIBRARY = list;
    }
    initSymbolLibrary();""",
"""      // Stable sort by category so entries appended to the catalogue later
      // still land under their own section header in the grouped view.
      const order = Object.keys(CATEGORY_DISPLAY_NAMES);
      list.forEach((s, i) => { s._i = i; });
      list.sort((a, b) => {
        const ca = order.indexOf(a.category), cb = order.indexOf(b.category);
        return (ca === cb) ? a._i - b._i : (ca < 0 ? 999 : ca) - (cb < 0 ? 999 : cb);
      });
      list.forEach(s => { delete s._i; });
      AAC_SYMBOL_LIBRARY = list;
      symbolIdIndex = null;
    }"""))
# CATEGORY_DISPLAY_NAMES is declared after initSymbolLibrary(); move the call below it.
R.append(("""      'social': '💬 Social & Phrases'
    };
""",
"""      'social': '💬 Social & Phrases'
    };
    initSymbolLibrary();

    // One renderer for every symbol card: the generated picture when the
    // catalogue has one, the emoji fallback otherwise (and if the picture
    // fails to load, e.g. a stale offline cache).
    function symbolCardIcon(sym) {
      const emoji = sym.emoji || sym.id;
      if (!sym.img) return `<div class="sym-icon">${emoji}</div>`;
      return `<div class="sym-icon"><img src="${sym.img}" loading="lazy" decoding="async" class="sym-img-icon" alt="${sym.label}" onerror="this.parentNode.textContent='${emoji}'"></div>`;
    }
"""))

# 3. Library grid card + inline strip card use the shared renderer.
R.append(("""        card.innerHTML = `
          <button type="button" class="sym-listen-btn" title="Hear ${s.label}" aria-label="Listen to ${s.label}" onclick="previewSymbolAudio(event, '${s.id}')">🔊</button>
          <div class="sym-icon">${s.emoji || s.id}</div>
          <div class="sym-name" title="${s.label}">${s.label}</div>
        `;""",
"""        card.innerHTML = `
          <button type="button" class="sym-listen-btn" title="Hear ${s.label}" aria-label="Listen to ${s.label}" onclick="previewSymbolAudio(event, '${s.id}')">🔊</button>
          ${symbolCardIcon(s)}
          <div class="sym-name" title="${s.label}">${s.label}</div>
        `;"""))
R.append(("""        card.innerHTML = `
          <button type="button" class="sym-listen-btn" title="Hear ${sym.label}" aria-label="Listen to ${sym.label}" onclick="previewSymbolAudio(event, '${sym.id}')">🔊</button>
          <div class="sym-icon">${sym.emoji || sym.id}</div>
          <div class="sym-name" title="${sym.label}">${sym.label}</div>
        `;""",
"""        card.innerHTML = `
          <button type="button" class="sym-listen-btn" title="Hear ${sym.label}" aria-label="Listen to ${sym.label}" onclick="previewSymbolAudio(event, '${sym.id}')">🔊</button>
          ${symbolCardIcon(sym)}
          <div class="sym-name" title="${sym.label}">${sym.label}</div>
        `;"""))

# 4. The value stored on a tile is the picture path when there is one.
R.append(("""    function selectLibrarySymbol(symbolObj) {
      pendingSymbol = symbolObj.emoji || symbolObj.id;""",
"""    function selectLibrarySymbol(symbolObj) {
      pendingSymbol = symbolValueOf(symbolObj);"""))
R.append(("""    function symbolValueOf(symbolObj) {
      return symbolObj.emoji || symbolObj.id;
    }""",
"""    function symbolValueOf(symbolObj) {
      return symbolObj.img || symbolObj.emoji || symbolObj.id;
    }"""))

# 5. Template/gallery bare-word resolution: prefer the picture, then emoji.
R.append(("""        for (const e of AAC_SYMBOL_LIBRARY) {
          if (e.svgPath) {
            symbolIdIndex.set(e.id.toLowerCase(), e.svgPath);
            const lbl = String(e.label || '').toLowerCase();
            if (lbl && !symbolIdIndex.has(lbl)) symbolIdIndex.set(lbl, e.svgPath);
          } else if (e.emoji && !symbolIdIndex.has(e.id.toLowerCase())) {
            symbolIdIndex.set(e.id.toLowerCase(), e.emoji);
          }
        }""",
"""        for (const e of AAC_SYMBOL_LIBRARY) {
          const val = e.img || e.emoji;
          if (!val) continue;
          if (!symbolIdIndex.has(e.id.toLowerCase())) symbolIdIndex.set(e.id.toLowerCase(), val);
          const lbl = String(e.label || '').toLowerCase();
          if (lbl && !symbolIdIndex.has(lbl)) symbolIdIndex.set(lbl, val);
        }"""))

# 6. Count badges for every chip.
R.append(("""      ['core', 'feelings', 'food', 'drinks', 'actions', 'people', 'places', 'play', 'daily', 'animals', 'health'].forEach(cat => {""",
"""      Object.keys(CATEGORY_DISPLAY_NAMES).forEach(cat => {"""))

# 7. Card CSS for the picture.
R.append(("""    .sym-card .sym-name {""",
"""    .sym-card .sym-img-icon {
      width: 56px;
      height: 56px;
      object-fit: contain;
      pointer-events: none;
    }

    .sym-card .sym-name {"""))
R.append(("""    .sym-card .sym-icon {
      font-size: 2.35rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 46px;
      width: 46px;
      pointer-events: none;
    }""",
"""    .sym-card .sym-icon {
      font-size: 2.35rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 56px;
      width: 56px;
      pointer-events: none;
    }"""))

# 8. The catalogue no longer says "modern symbols" in a placeholder only; the
#    editor's "Browse" button is the "choose a different image" entry point.
R.append(("""                <span>Browse All Symbols</span>""",
"""                <span>Choose a Different Image</span>"""))

ok = True
for f in FILES:
    src = open(f, encoding="utf-8").read()
    for i, (old, new) in enumerate(R):
        n = src.count(old)
        if n != 1:
            print(f"{f}: replacement #{i} matched {n} times"); ok = False; continue
        src = src.replace(old, new)
    if ok:
        open(f, "w", encoding="utf-8").write(src)
        print("patched", f)
sys.exit(0 if ok else 1)
