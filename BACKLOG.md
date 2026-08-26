# Backlog

Ideas and open points for wordler. None of it is in progress; within each section
the order is roughly by usefulness.

## Next up

- [ ] **Merge terms (aliases).** Drag several rows in the terms table onto one
  name: "risk", "risks" and "Risiko" become one term and their counts add up.
  The single biggest lever on quality — half-separated spellings are the most
  common reason a cloud turns out useless.
- [ ] **Rename terms and override weights in place.** Today a term can only be
  switched off. An editable cell in the terms table would replace editing the
  source file and re-importing.
- [ ] **State in the URL.** Put every setting (not the data) in the hash, so a
  link carries the configuration. Presets as a file already exist; a link is the
  shorter path.
- [ ] **Layout in a web worker.** At 300 terms and several auto-fit passes the
  main thread visibly blocks. A worker keeps the preview responsive and makes a
  progress indicator possible.
- [ ] **Embed the font in the SVG export.** Without Inter installed, an exported
  SVG falls back to a system font and the words overlap. A subsetted WOFF2 in an
  `@font-face` rule fixes it; the alternative is converting text to paths.

## Input and data

- [ ] Drop several files at once and merge them (sum per term).
- [ ] Import straight from the clipboard, including tables copied out of Excel.
- [ ] Read `.xlsx` (no library needed: ZIP plus `sheet1.xml` covers simple books).
- [ ] Remember the column mapping when the same headers show up again.
- [ ] Treat a third numeric column as a time axis: one cloud per period, plus a
  before/after comparison.
- [ ] Warn instead of silently capping at 300 terms.

## Analysis and language

- [ ] Stemming/lemmatisation for German and English (Porter/Snowball, implemented
  here), switchable — merging forms automatically is convenient but error-prone,
  so never the default.
- [ ] More stop-word lists (FR, ES, IT, NL) plus automatic language detection.
- [ ] Remove a stop word straight from the cloud: click a word in the preview and
  it drops out.
- [ ] TF-IDF weighting against a reference text — surfaces what makes *this* text
  distinctive rather than what is frequent in every text.
- [ ] Filter by part of speech (nouns only). Needs a small dictionary, but pays
  off especially for free text from interviews.

## Layout and appearance

- [ ] More shapes: cloud, speech bubble, arrow, ring, and text as a shape ("2026"
  as a mask rendered from a typeface).
- [ ] Drag placed words with the mouse and pin their position.
- [ ] A line-based layout as an alternative to the spiral: an evenly justified
  block, which often suits a report better than a round cloud.
- [ ] Outline and shadow options for words (legibility over a busy background).
- [ ] Background image instead of a colour, with a dimming control.
- [ ] Build and save a custom palette; pull colours out of an uploaded image.
- [ ] Contrast check: flag words whose colour falls below 4.5:1 on the background.
- [ ] A legend under the cloud mapping type size to score, so a report carries the
  scale along with the picture.

## Export and sharing

- [ ] PDF export (vector, print-ready, page size in millimetres).
- [ ] Free export size in pixels instead of the fixed 1×–4× steps.
- [ ] Several formats at once, as a ZIP.
- [ ] Export the computed values as CSV (term, count, weight, score, type size) —
  for the table next to the picture in a report.
- [ ] Animated build-up as a short video or GIF for presentations.

## Interaction and accessibility

- [ ] Side-by-side view: compare two settings against each other.
- [ ] Undo/redo for setting changes.
- [ ] Remember the last settings automatically (today only the language is kept).
- [ ] A full screen-reader pass with NVDA and VoiceOver; the preview needs a more
  useful alternative description than its first twelve terms.
- [ ] Keyboard shortcuts: export, reroll, collapse/expand a panel.
- [ ] A light colour scheme for the interface (dark only today).

## Engineering

- [ ] Layout tests against a real canvas (Playwright) in CI, with reference images.
- [ ] Move collision testing to 32-bit word masks; on very dense clouds that is
  noticeably faster than today's byte comparison.
- [ ] Check the export memory ceiling: 8000 px on the long edge is too much for
  some mobile devices.
- [ ] A service worker for genuine offline use, installable as an app.
- [ ] Tie the mask resolution to the cloud area instead of fixed 3 px cells — at
  very small formats today's grid is too coarse.

## Deliberately not planned

- Accounts, server storage, real-time collaboration. The app stays client-side.
- Automatic translation of terms.
- AI-generated terms: a cloud should show what is in the data, not what a model
  thinks belongs next to it.
