<h1 align="center">wordler</h1>

<p align="center">
  <img src="public/assets/logo.svg" alt="" width="72" height="72">
</p>

<p align="center">
  Turn text — or a weighted table of topics — into a word cloud, and export it as a
  normal image. Everything runs in the browser: no backend, no accounts, no uploads.
</p>

## Why another word cloud tool

Most word clouds size words by raw frequency alone. That flatters filler words and
buries the terms that carry the message. wordler takes **two** numbers per term — how
often it came up, and how much it matters — and lets you slide between them:

```
score = (1 − α) · counts + α · priority
```

α is a slider. The formula is printed in the interface, so a cloud that ends up in a
report can be explained rather than defended.

## Features

**Input**

- Free text: paste it, drop a `.txt`, or type into the box
- Weighted tables: drop a `.csv`/`.tsv`, delimiter and header row detected automatically
- Column mapping — term / count / weight — guessed on import and changeable at any time
- Sample data included

**Text analysis**

- German and English stop-word lists, each switchable, plus your own
- Minimum word length, drop numbers, lowercase normalisation
- Single words, word pairs or triples (phrases never cross sentence boundaries)
- Cap on the number of terms

**Weighting**

- Counts ↔ priority slider
- Linear, square-root, logarithmic or rank scaling
- Smallest and largest type size

**Layout**

- Shapes: rectangle, ellipse, circle, heart, star, diamond, arch — or your own image
  as a mask, with an adjustable threshold and an invert switch
- Rotation: none, 0/90°, ±60°, or free
- Word spacing, aspect ratio (1:1, 4:3, 16:9, 4:5, 9:16)
- Seed field: the same seed and settings always produce the same image
- Auto-fit searches for the largest type scale at which every term still fits

**Design**

- Bundled Inter plus serif, monospace, condensed and wide system stacks
- Nine palettes, colour by score, by rank, at random, or a single colour
- Solid, gradient or transparent background
- Optional title, subtitle and source line

**Terms table**

Every term with its count, weight and computed score — untick one and it leaves both
the cloud and the weighting.

**Output**

- PNG (with transparency), JPEG, WebP and SVG
- 1× to 4× resolution, capped at 8000 px on the long edge
- Copy to clipboard
- Settings saved and reloaded as a JSON preset
- German/English interface, remembered between visits

## Data format

The table input is deliberately generic, but it was built around a shape like this
(`public/samples/topics.csv`, synthetic data):

```csv
Topic,Count,Weight
Planning,8,100
Onboarding,7,95
Documentation,7,88
Reporting,7,82
```

First text column becomes the term, first numeric column the count, second numeric
column the weight — all three re-assignable after import. See
[`docs/DATA-FORMAT.md`](docs/DATA-FORMAT.md).

## Running it

The app is plain HTML, CSS and ES modules — there is nothing to build. ES modules need
a real origin, so serve the folder rather than opening the file:

```sh
cd public && python3 -m http.server 8000
# then open http://localhost:8000
```

GitHub Pages is wired up in `.github/workflows/pages.yml` and publishes `public/`
on every push to `main`. It needs to be switched on once, by hand: **Settings →
Pages → Build and deployment → Source: GitHub Actions**. The workflow cannot do
that step itself — the Actions token is not allowed to create the Pages site.

A self-test for the pure logic (parsing, tokenising, weighting) runs without a browser:

```sh
node tools/selftest.mjs
```

## How the layout works

No layout library is used. Each term is drawn into an offscreen canvas — rotation and
the word spacing baked in as an outline — and reduced to a bitmap mask. A shared
occupancy grid starts out with everything *outside* the chosen shape marked as taken,
so one test covers both collision and shape. Terms are placed largest first along an
Archimedean spiral from the centre; the first position where the mask does not overlap
wins. The resulting list of positions feeds both renderers, which is why the SVG and
the PNG are pixel-for-pixel the same picture.

## Privacy

No network requests after the page loads. A Content Security Policy in `index.html`
enforces it, and the app works offline. Your text, your CSV and your mask image never
leave the browser.

## Backlog

Planned and considered work lives in [`BACKLOG.md`](BACKLOG.md).

## Licence

MIT, see [`LICENSE`](LICENSE). Bundled Inter is licensed under the SIL Open Font
License 1.1.
