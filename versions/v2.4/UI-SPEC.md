# UI-SPEC — talk tiles (GoTalk Now Faithful Recreation)

This document specifies the exact visual design, layout metrics, color palette, typography, icon styling, component states, and interactive workflows for the **talk tiles** AAC application, reconstructed pixel-by-pixel from the 24 unique reference screenshots (`/home/mike/talk-tiles-ref/gt-01.png` – `gt-26.png`) and the demonstration video transcript (`transcript.txt`).

---

## 1. Screen Inventory & Component Anatomy

### 1.1 Home Screen ("GoTalk NEW" / "talk tiles" Hub)
- **Top Header Area**:
  - Background: Clean white curved arch (`border-bottom-left-radius: 50% 30px`, `border-bottom-right-radius: 50% 30px` or smooth SVG curve) over the primary app green background (`#008369`).
  - App Logo: Bold green text `"talk tiles"` accompanied by a bright orange rounded speech bubble badge containing `"NEW"` and a 4-grid tile icon.
- **Main Launch Buttons**:
  - **Player Button**: Large prominent orange rounded rectangle (`#f27935`), white bold text `"Player"`, 4-grid tile icon on the right. Tapping launches user-mode communication playback.
  - **4 Secondary Grid Buttons** (2 columns x 2 rows of orange rounded rectangles `#f27935`):
    1. **Page Editor**: Dashed rounded rectangle icon with diagonal pencil + white text `"Page Editor"`.
    2. **Settings**: Twin gear cogs icon + white text `"Settings"`.
    3. **Downloads**: 4-square grid with down arrow icon + white text `"Downloads"`.
    4. **Help**: Circle with question mark `?` icon + white text `"Help"`.
- **Bottom Bar / Footer**:
  - Left: Circular orange speech bubble `"Feedback"` button.
  - Center: Clean white subtitle text `"Default Book (Tap for More)"`.

---

### 1.2 User-Mode Standard Communication Page
- **Top Express Bar (Speech Bar)** *(Visible when "Express Page" is enabled)*:
  - Container: Full-width rounded white rectangular box with a thin dark/grey border (`#111111` or `#cbd5e1`), white background, subtle inner shadow.
  - Height: ~54px – 60px.
  - Content: Horizontal scrolling sequence of collected tile chips (small thumbnail + label text) tapped by the user.
  - Clear / Delete Button (Right side): White luggage-tag / backspace shape containing a bold red `"X"` icon (`#d32f2f`). Tapping deletes the last word or clears the bar.
  - Interaction: Tapping the Express Bar speaks the accumulated sentence in order using TTS / recorded cues.
- **Main Tile Grid**:
  - Grids supported: **1, 2, 4 (2x2), 9 (3x3), 16 (4x4), 25 (5x5), 36 (6x6)**.
  - Tiles fill available viewport without scrolling.
  - Tile Appearance (Active/Filled):
    - White or solid colored card background (e.g., Red `#c4312a`, Orange `#e27a2b`, Yellow `#d8c43e`, Blue `#4472af`, Dark Green `#004838`, White `#ffffff`).
    - Border: 2px – 3px solid black (`#000000`) or theme border, `border-radius: 12px – 16px`.
    - Content: Centered symbol/photo on top (~65–75% height) + crisp label text at the bottom.
    - Active Tap Feedback: Neon green highlight border (`#00e676` / `#39ff14`, 4px) and subtle scale pulse.
- **Bottom Bar** (see Section 2 for details).

---

### 1.3 User-Mode Scene Page (Visual Scene Display)
- **Background**: High-resolution full-bleed photograph (e.g. classroom, office, playground, elevator, kitchen).
- **Hotspots (Active Regions)**:
  - Invisible or subtle translucent outline during normal idle state.
  - When tapped: Highlights with neon green border (`#00e676`), plays assigned voice recording or TTS auditory cue.
- **Bottom Navigation Bar**: Consistent dark teal bar with Home, Previous Page, Undo/Back, Page Title ("Page N"), Action/Jump icon, Speech Cue `!`, Play button.

---

### 1.4 Editor-Mode Standard Page
- **Empty Cells (Unassigned Slots)**:
  - Border: `2px dashed #8e8e93` (medium grey dashed border).
  - Background: Subtle light grey or white fill (`#f8fafc` or `#ffffff`), `border-radius: 12px – 16px`.
  - Center Content: Dark grey text `"Tap to Add Button"` (`#475569`, font-weight 600, ~15–18px).
  - Interaction: Tapping opens the Tile Editor dialog.
- **Assigned Cells**:
  - Displays tile thumbnail, label, solid border, with edit overlay / tap to modify.
- **Bottom Bar Controls**:
  - Includes Page Options (Sliders), Layers/Pages browser, Auditory cues `!`, and Add New Page (`+`).

---

### 1.5 Editor-Mode Scene Page
- **Photo Area**: Full photograph background with interactive hotspot overlay boxes.
- **Hotspots in Editor**:
  - Fill: Semi-transparent blue `rgba(74, 96, 224, 0.40)`.
  - Border: Solid blue `2px solid #3b5bdb`.
  - Resize Handles: 8 circular white grab handles (4 corners + 4 edge midpoints) with thin blue borders.
  - Interaction: Drag to move, handles to resize, tap to open Hotspot Context Menu.
- **Hotspot Context Menu (Popover)**:
  - White rounded card (`border-radius: 10px`, box shadow `0 8px 24px rgba(0,0,0,0.2)`).
  - Menu Items (separated by `#e5e5ea` hair dividers):
    1. `"Delete"` (red/grey action)
    2. `"Set Action"` (blue text)
    3. `"Set Auditory Cue"` (blue text)
    4. `"After Action"` (blue text)
    5. `"Disable"` (grey text)

---

### 1.6 Page Options Popover Dialog
Opened by tapping the 3-sliders icon on the bottom bar in Editor Mode.
- **Popover Card**:
  - White background (`#ffffff`), `border-radius: 14px`, pointer beak pointing down to the bottom bar slider icon.
  - Header: Bold dark title `"Page Options"`, Share/Action icon (box with upward arrow) on top-right.
- **Setting Rows**:
  1. **Background**: Label `"Background"` (left) | Color swatch rounded pill / rectangle preview (right) | Chevron `>`
  2. **Buttons Grid Selector**:
     - Label `"Buttons"` (left)
     - Segmented Control with 7 pill segments: `[ 1 | 2 | 4 | 9 | 16 | 25 | 36 ]`
     - Inactive segment: light grey `#efeff4`, text `#1c1c1e`
     - Active segment: solid teal/green `#008369` / `#008a9a`, text `#ffffff`, smooth pill highlight
  3. **Scanning Auditory Cues**: Label `"Scanning Auditory Cues"` (left) | Chevron `>` (right)
  4. **Enabled**: Label `"Enabled"` | iOS style toggle switch (Green `#008369` when active)
  5. **Express Page**: Label `"Express Page"` | iOS style toggle switch (enables/disables top speech sentence bar)
  6. **Page Specific Scanning**: Label `"Page Specific Scanning"` | iOS style toggle switch

---

### 1.7 Page Background Color Picker Popover
Opened by tapping `"Background"` in Page Options.
- **Header**: `< Back` navigation button (left), `"Page Background"` title (center).
- **Segmented Tabs**: `[ Swatches | Picker ]`
- **Swatches Tab**:
  - 4 columns x 4 rows = 16 rounded square color swatches:
    - Row 1: `#FFFFFF` (White), `#111111` (Black), `#6c757d` (Dark Grey), `#b0b7bd` (Light Grey)
    - Row 2: `#fbf6a7` (Pale Yellow), `#b8e8db` (Mint Green), `#79cbd0` (Cyan/Teal), `#ea695b` (Coral/Salmon)
    - Row 3: `#b392e6` (Lavender), `#f4a261` (Peach/Orange), `#e63946` (Bright Red), `#e040fb` (Magenta/Pink)
    - Row 4: `#795548` (Brown), `#1b5e20` (Dark Forest Green), `#1a237e` (Navy Blue), Checkerboard icon (Transparent / Default)
- **Picker Tab**:
  - Hex Input field: `#00A699` with clear button
  - `"Set Via Hex"` action button
  - 2D Hue/Saturation Color Spectrum Box
  - Brightness/Value slider bar

---

### 1.8 New Page Popover Menu
Opened by tapping the orange `+` button on the bottom bar in Editor Mode.
- **Header**: `"New Page"` (centered bold text).
- **List Items**:
  1. TV/Display icon + `"Online Gallery"` + `>`
  2. Person icon + `"My Templates"` + `>`
  3. Book/Folder icon + `"Import from Another Book"`
  4. Duplicate pages icon + `"Duplicate Page"`
  5. Magic wand icon + `"Page Wizard"`
  6. Keyboard icon (`ab`) + `"Keyboard Page"`
  7. Landscape frame icon + `"Add Blank Scene Page"`
  8. 4-grid tile icon + `"Add Blank Button Page"`

---

### 1.9 Set Auditory Cue Modal Dialog
Modal for configuring speech/voice on a tile or hotspot.
- **Window Styling**:
  - Dark metallic gradient top title bar (`#3a3a3c` to `#1c1c1e`) with circular `'X'` close button on top-left.
  - Title: Centered white text `"Set Auditory Cue"`.
  - Body: Light grey/white background.
- **Input Controls**:
  - Segmented Audio Mode: `[ Recorded Audio | Text-to-Speech | None ]` (Active mode highlighted in dark green `#007a5e`).
  - Text Input Field: Placeholder `"What to say..."`, white background, rounded border, clear `'X'` button on right.
  - Three Bottom Action Buttons:
    1. `"Voice"` (Teal rounded button `#008369`)
    2. `"Preview"` (Dark green rounded button `#00684a`)
    3. `"Use Second Voice"` (Dark green rounded button `#00684a`)

---

### 1.10 "Complete" Transient HUD Toast
- Center screen dark overlay: `rgba(28, 28, 30, 0.88)` rounded rectangle (110px x 110px, radius 16px).
- Icon: Bold white circle with black checkmark.
- Label: Crisp white bold text `"Complete"`.
- Auto-fades after ~1.2 seconds upon saving or changing key page options.

---

## 2. Bottom Bar Specification

The bottom bar is the signature persistent navigation and tool bar running horizontally across the bottom of the screen.

### 2.1 Dimensions & Styling
- **Height**: 56px (compact) to 64px (standard tablet).
- **Background Color**: Solid rich teal green `#008369` (RGB: 0, 131, 105).
- **Border**: Clean top divider `1px solid rgba(0, 0, 0, 0.15)`.
- **Text & Icon Color**: Clean white `#ffffff`.

### 2.2 Button Order & Inventory (Left to Right)

#### A. In Editor Mode:
1. **Previous Page Button**: White left-pointing triangle (`◀`) in a soft rounded container.
2. **Home Button**: Distinctive bright orange square button (`#f27935`, radius 8px, 42px x 42px) containing a crisp white house silhouette icon.
3. **Page Options (Sliders) Button**: Teal/green button with 3 vertical slider adjustment bars with knobs icon. Tapping toggles the Page Options popover.
4. **Center Page Label**: Centered bold text `"Page N"` (e.g. `"Page 1"`, `"Page 6"`, `"Page 10"`) in clean white sans-serif.
5. **Layers / Pages Navigator Button**: Icon of 3 stacked rectangular cards/sheets (thumbnail drawer / page jump).
6. **Auditory Cue / Alert Button**: Speech bubble containing an exclamation point `!`.
7. **Add / Plus Button**: Bright orange circular button (`#f27935`, diameter 44px) with bold white `+` sign.

#### B. In User Mode (Standard & Scene Pages):
1. **Previous Page Button**: White left-pointing triangle (`◀`).
2. **Home Button**: Bright orange square button (`#f27935`) with white house icon (navigates to Home screen).
3. **Undo / Back Navigation Button**: Curved return arrow icon (`↩` / `⮌`).
4. **Center Page Title**: Shows current page name (e.g. `"Colors"`, `"School"`, `"Yes/No Board"`, `"Page 4"`), optionally with small page thumbnail/icon.
5. **Action / Jump Icon**: White jumping/running figure icon.
6. **Auditory Speech Icon**: White speech bubble with `!`.
7. **Play Button**: Circular bright green button (`#00a86b`) with solid white right-pointing play triangle (`▶`). Tapping plays all buttons or page sequence.

---

## 3. Tile System & Grid Layouts

### 3.1 Supported Grid Sizes
| Grid Preset | Layout (Cols x Rows) | Total Cells | Visual Target & Use Case |
|---|---|---|---|
| **1** | 1 x 1 | 1 | Single large choice / prompt |
| **2** | 2 x 1 (or 1 x 2) | 2 | Binary choices (e.g. "yes" / "no") |
| **4** | 2 x 2 | 4 | Standard 4-item core board (e.g. "Colors", "Eat/Drink/Play/Help") |
| **9** | 3 x 3 | 9 | Classic medium communication board |
| **16** | 4 x 4 | 16 | Dense school / activity board (e.g. "School" schedule & subjects) |
| **25** | 5 x 5 | 25 | Advanced vocabulary |
| **36** | 6 x 6 | 36 | Comprehensive high-density grid |

### 3.2 Tile Geometry & Spacing
- **Outer Margins & Gap**:
  - Margin: 12px – 16px around grid perimeter.
  - Gap: 10px – 14px between tiles.
- **Card Styling**:
  - `border-radius: 12px` (standard) to `18px` (large 2x2/1x1).
  - Background: `#ffffff` default, or custom background color.
  - Border: `2px solid #000000` (crisp black high-contrast outline) or customized border color.
  - Elevation/Shadow: `0 2px 8px rgba(0, 0, 0, 0.08)`.

### 3.3 Tile Content Hierarchy
1. **Symbol / Image**:
   - Takes up ~65% – 75% of vertical tile space.
   - Preserves aspect ratio with `object-fit: contain` (or `cover` if user selected fill).
   - Centered horizontally and vertically in the upper partition.
2. **Label Text**:
   - Pinned to bottom of the card.
   - Text style: Clean sans-serif (system font, Roboto/Arial/SF Pro), dark charcoal `#111111` or `#ffffff` on dark cards.
   - Size scales dynamically to fit tile width without truncating words (`fitTextToBox`).

---

## 4. Color Palette & Exact Sampled Hex Codes

| Semantic UI Role | Sampled Hex | RGB Values | Usage |
|---|---|---|---|
| **Bar Teal Green** | `#008369` | `rgb(0, 131, 105)` | Bottom bar, app headers, primary branding |
| **Accent Orange** | `#f27935` | `rgb(242, 121, 53)` | Home button, Add (`+`) button, Player button |
| **Dark Header Green**| `#005040` | `rgb(0, 80, 64)` | User-mode header accents, dark variations |
| **Play Button Green**| `#00a86b` | `rgb(0, 168, 107)` | Bottom bar round play button |
| **Active Green Pill** | `#008a9a` | `rgb(0, 138, 154)` | Selected segment pill in Page Options & Auditory Cue |
| **Toggle Active Green**| `#008b6e` | `rgb(0, 139, 110)` | iOS toggle switch ON state |
| **Hotspot Editor Fill**| `rgba(74, 96, 224, 0.40)` | `rgba(74, 96, 224, 0.4)` | Blue translucent hotspot bounding box |
| **Hotspot Editor Border**| `#3b5bdb` | `rgb(59, 91, 219)` | Blue hotspot bounding box stroke |
| **Neon Tap Highlight**| `#00e676` | `rgb(0, 230, 118)` | Active feedback on tap/scan |
| **Dialog Card BG** | `#ffffff` | `rgb(255, 255, 255)` | Popovers, modal cards |
| **Dialog Divider** | `#e5e5ea` | `rgb(229, 229, 234)` | Separator lines in menus |
| **HUD Toast BG** | `rgba(28, 28, 30, 0.88)` | `rgba(28, 28, 30, 0.88)`| "Complete" toast notification |
| **Red Erase / Danger**| `#d32f2f` | `rgb(211, 47, 47)` | Express bar clear 'X', Delete actions |

### Standard Tile Swatches:
- Red: `#c4312a`
- Orange: `#e27a2b`
- Yellow: `#d8c43e`
- Blue: `#4472af`
- Dark Green: `#004838`
- Mint: `#b8e8db`
- Cyan: `#00a699`

---

## 5. Text & Verbatim String Inventory

All user-facing strings must match the reference application:
- **Branding**: `"talk tiles"`
- **Home**: `"Player"`, `"Page Editor"`, `"Settings"`, `"Downloads"`, `"Help"`, `"Feedback"`, `"Default Book (Tap for More)"`
- **Page Options**:
  - Title: `"Page Options"`
  - Rows: `"Background"`, `"Buttons"`, `"Scanning Auditory Cues"`, `"Enabled"`, `"Express Page"`, `"Page Specific Scanning"`
- **New Page Menu**:
  - Title: `"New Page"`
  - Items: `"Online Gallery"`, `"My Templates"`, `"Import from Another Book"`, `"Duplicate Page"`, `"Page Wizard"`, `"Keyboard Page"`, `"Add Blank Scene Page"`, `"Add Blank Button Page"`
- **Scene Background**:
  - Title: `"Scene Background Image"`
  - Items: `"Take Photo"`, `"From Photo Library"`
- **Hotspot Context Menu**:
  - Items: `"Delete"`, `"Set Action"`, `"Set Auditory Cue"`, `"After Action"`, `"Disable"`
- **Set Auditory Cue**:
  - Title: `"Set Auditory Cue"`
  - Mode Tabs: `"Recorded Audio"`, `"Text-to-Speech"`, `"None"`
  - Placeholder: `"What to say..."`
  - Buttons: `"Voice"`, `"Preview"`, `"Use Second Voice"`
- **Editor Tiles**: `"Tap to Add Button"`
- **Toast**: `"Complete"`
- **Page Background**: `"Page Background"`, `"Swatches"`, `"Picker"`, `"Set Via Hex"`

---

## 6. Features, Behavioral Flow & State Transitions

1. **Mode Switching**:
   - Home Screen allows one-tap entry into **Player** (User Mode) or **Page Editor**.
   - Bottom bar Orange Home button returns directly to Home Screen from any mode.
   - User Mode is distraction-free: no dashed borders, no editing triggers on tap, instant audio speech playback.
   - Editor Mode allows modifying grid dimensions, backgrounds, toggling Express bar, adding pages, editing tile contents, and manipulating scene hotspots.

2. **Express Mode (Sentence Builder)**:
   - When `"Express Page"` toggle is ON in Page Options, the white Express Bar appears at the top.
   - Tapping any tile plays its sound AND adds a chip to the top Express Bar.
   - Tapping the Express Bar speaks the accumulated sentence.
   - Tapping the Red `'X'` clear button removes the last item or clears the bar.

3. **Scene Pages (Visual Scene Displays)**:
   - Supports custom background photo.
   - Allows creating multiple rectangular hotspots.
   - Each hotspot stores its bounding box coordinates `[x, y, width, height]`, label/title, and auditory cue (recorded voice or TTS string).
   - In User Mode, tapping a hotspot highlights it in bright green and speaks its auditory cue.

4. **Speech & Audio Subsystem**:
   - Primary: SpeechSynthesis API for TTS with customizable rate, pitch, and voice.
   - Secondary: Audio recording via HTML5 MediaRecorder API storing high-quality audio blobs in IndexedDB.
   - Audio playback triggers visual pulse feedback on the active tile or hotspot.

5. **Multi-Page Book Navigation**:
   - Multiple pages stored in IndexedDB.
   - Left/Right navigation arrows in bottom bar flip between pages.
   - Layers icon opens quick page selector sheet to jump to any page in the book.
