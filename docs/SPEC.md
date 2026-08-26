# wordler — implementation brief

This document is written so that it can be handed to a **coding AI as a single
assignment**. It describes in full *what* gets built, *how* it behaves, and *how*
completion is measured.

---

## 1. The assignment in one sentence

Build **wordler**, a web application that turns free text **or** a weighted CSV
table into a word cloud and exports it as an ordinary image (PNG, JPEG, WebP) as
well as a vector (SVG) — entirely in the browser, no backend, nothing leaving the
device.

## 2. Non-negotiable constraints

| Point | Requirement |
| --- | --- |
| Execution | 100 % client-side. No server, no API calls, no telemetry. |
| Dependencies | None. No npm build, no framework, no CDN. Plain HTML/CSS/ES modules. |
| Deployment | Static hosting (GitHub Pages). `public/` is the web root. |
| Privacy | Input data never leaves the browser. No uploads, no outbound `fetch`. Enforced by CSP. |
| Languages | German and English interface, switchable, choice remembered. |
| Accessibility | WCAG 2.1/2.2 AA: every control has an accessible name, a visible focus ring, status messages in a live region, full keyboard operation. |
| Reproducibility | Same input + same seed = pixel-identical result. |

## 3. Data model

Two input paths lead into **one** internal structure:

```js
/** @typedef {{
 *   label: string,      // the text shown
 *   count: number,      // frequency / mentions (raw)
 *   weight: number,     // priority / relevance (raw, optional)
 *   score: number,      // computed, 0..1, drives the type size
 *   enabled: boolean    // the user can switch a term off
 * }} Term */
```

### 3.1 Input path A — free text

Textarea or `.txt` file. Pipeline: normalise → tokenise → filter → count →
`count` = frequency, `weight` = frequency.

### 3.2 Input path B — CSV (the more important case)

Delimiters `,` `;` `\t` are detected automatically, as is the header row.
Reference schema (the sample file lives at `public/samples/topics.csv`; its
contents are synthetic):

```csv
Topic,Count,Weight
Planning,8,100
Onboarding,7,95
Documentation,7,88
Reporting,7,82
Automation,6,84
```

- Column 1 (text) → `label`
- First numeric column → `count` (mentions)
- Second numeric column → `weight` (priority)

**Important:** the column mapping is not hard-wired. After the import the UI shows
three select boxes (term / count / weight), pre-filled from the heuristic above and
changeable at any time. Arbitrary CSVs with different column names therefore work
just as well.

### 3.3 Computing the score

Both raw quantities are normalised separately to 0..1 (min–max across all active
terms), then blended:

```
base  = (1 − α) · norm(count) + α · norm(weight)      // α = slider, 0..1
score = shape(base)                                    // linear | sqrt | log | rank
size  = minFontSize + score · (maxFontSize − minFontSize)
```

α is a visible slider, "counts ↔ priority". The active formula is printed in the
interface in plain language, so the result stays explainable (reports!). `shape`
compresses (`log`, `sqrt`) or spreads the distribution; `rank` ignores absolute
values and uses the order alone.

## 4. Scope of V1

### 4.1 Source data
- "Text" tab / "CSV" tab
- Drag-and-drop area with a click fallback, for `.txt`, `.csv`, `.tsv`
- "Load sample data" button
- Error handling: empty file, no numeric column, > 20 MB → a comprehensible
  message, never a crash

### 4.2 Text analysis (text mode only)
- Normalise to lowercase (on/off)
- German / English stop-word lists, each switchable on its own
- Custom stop words (comma separated)
- Minimum length (1–12 characters)
- Drop numbers
- N-grams: 1 (words) or 2 (word pairs, never formed across a sentence boundary)
- Maximum number of terms (10–300)

### 4.3 Weighting
- Column mapping (see 3.2)
- α slider (counts ↔ priority)
- Scaling: linear / square root / logarithm / rank
- Minimum and maximum type size

### 4.4 Layout
- Cloud shape: rectangle, ellipse, circle, heart, star, diamond — plus a **custom
  image mask** (upload a PNG/JPEG, threshold over brightness/alpha, preview)
- Rotation: none / 0° + 90° / random ±60° / free
- Word spacing (padding in px)
- Aspect ratio: 1:1, 4:3, 16:9, 4:5, 9:16, custom
- Seed field plus "reroll"
- Auto-fit: when not every term fits, sizes shrink iteratively (max. 8 passes)
  rather than words being dropped silently. Whatever still does not fit at the end
  is reported as a number in the status area.

### 4.5 Design
- Type: bundled Inter (500/700/800) plus system stacks (sans, serif, mono, condensed)
- Weight, letter case (original / uppercase / title case)
- Curated palettes (at least 8, light and dark) plus custom colours
- Colour mapping: by score (ramp), by rank, random, single colour
- Background: colour, gradient or transparent
- Optional title, subtitle and source line below the cloud

### 4.6 Terms list
A table of every term: rank, text, count, weight, computed score, and a checkbox to
exclude it. Exclusions take effect immediately and survive a re-import for as long
as the term still exists.

### 4.7 Export
- PNG (transparency possible), JPEG (quality slider), WebP, SVG
- Scale 1×/2×/3×/4×, hard ceiling of 8000 px on the long edge
- "Copy to clipboard"
- Filename derived from the title, otherwise `wordcloud`
- Settings exported/imported as JSON (presets)

## 5. Layout algorithm (binding)

No third-party code; implement it here, along the lines of the spiral/sprite
approach in `d3-cloud`:

1. **Occupancy grid.** A `Uint8Array` over the drawing area, cell size about 2
   design pixels. Everything **outside** the chosen shape is marked as taken up
   front. One single test then covers both collision *and* staying inside the shape.
2. **One sprite per term.** The term is drawn into an offscreen canvas (rotation
   included) and additionally outlined with `strokeText` at the padding width, which
   bakes the minimum spacing in. Its alpha values become a downscaled bitmap mask.
3. **Placement.** Terms in descending size order. An Archimedean spiral from the
   centre; at each position the mask is tested against the grid (bailing out on the
   first hit). If it fits, it is stamped into the grid and the position, angle and
   size are recorded.
4. **Result.** A list of placed terms with `x, y, angle, fontSize, color`. **Both**
   outputs render from it: canvas (raster images) and SVG. That is what guarantees
   the SVG and the PNG look identical.

The algorithm runs on the main thread but must stay under ~1.5 s at 300 terms; a
visible loading state is mandatory.

## 6. Structure

```
public/
  index.html
  style.css
  js/
    main.js         wiring, state, rendering the preview
    ui.js           DOM helpers, applying i18n, language switcher
    parse.js        CSV/text detection and splitting
    tokenize.js     tokeniser, stop words, n-grams
    weights.js      normalisation, blending, scaling
    layout.js       occupancy grid, sprites, spiral
    shapes.js       shape masks including the image mask
    render.js       canvas and SVG output
    exporters.js    building blobs, download, clipboard
  data/
    i18n.js  stopwords.js  palettes.js
  samples/  fonts/  assets/
docs/   README.md   BACKLOG.md
```

## 7. Acceptance criteria

1. Load `public/samples/topics.csv` → without any further intervention a legible
   cloud appears in which "Planning" is the largest term.
2. Drag α from 0 to 1 → the order visibly shifts in favour of priority, without a
   reload.
3. Fix the seed, reload the page, same settings → an identical picture.
4. Export a PNG at 4× with a transparent background → the file opens in an image
   viewer, the margins are transparent, the text is crisp.
5. Open an exported SVG in a vector program → every term is its own editable text
   object, in the same place as in the PNG.
6. Operating the app by keyboard alone, all the way to the export, is possible;
   every control is announced by a screen reader.
7. No network traffic after the initial load (the network tab stays empty).
8. The application works offline.

## 8. Deliberately out of scope for V1

Collaboration, accounts, server storage, live data sources, automatic translation,
lemmatisation/stemming, animated word clouds. These live in the backlog
(`BACKLOG.md`) and must not be pulled forward.
