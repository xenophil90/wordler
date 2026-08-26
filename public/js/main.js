import { $, t, show, debounce, applyLanguage, detectInitialLang, initLangSwitch, bindSegmented, bindSwitch, bindDropzone } from './ui.js';
import { parseTable, guessColumns, rowsToTerms, errorWithCode } from './parse.js';
import { tokenize } from './tokenize.js';
import { computeScores, formulaText } from './weights.js';
import { buildMask, freeRatio } from './shapes.js';
import { layoutCloud } from './layout.js';
import { computeFrame, drawCloud, buildSvg, assignColors } from './render.js';
import { canvasToBlob, svgToBlob, downloadBlob, copyToClipboard, safeFilename } from './exporters.js';
import { PALETTES, paletteById } from '../data/palettes.js';

// Die Wolke wird immer in "Design-Pixeln" berechnet. Der Export skaliert nur
// noch die Zeichenoperationen — dadurch ist jede Auflösung dasselbe Bild.
const BASE_WIDTH = 1600;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXPORT_EDGE = 8000;
const MASK_CELL = 3;

const state = {
  mode: 'text',
  raw: '',
  table: null,
  mapping: { label: 0, count: -1, weight: -1, numeric: [] },
  excluded: new Set(),
  maskImage: null,

  lowercase: true, stopDe: true, stopEn: true, dropNumbers: true,
  customStop: '', minLength: 3, ngram: 1, maxTerms: 120,

  alpha: 0.5, scale: 'sqrt', minFont: 20, maxFont: 130,

  shape: 'rect', maskThreshold: 0.5, maskInvert: false,
  rotation: 'none', padding: 2, ratio: '4:3', seed: 'wordler',

  font: 'Inter', weight: 700, textCase: 'original',
  palette: 'aurora', colorMode: 'score', singleColor: '#f5f6f8',
  background: 'solid', bgColor: '#0e1016', bgColor2: '#1b1440',
  title: '', subtitle: '', source: '',

  format: 'png', scaleFactor: 1, quality: 0.92,
};

let model = null;   // letztes Layout-Ergebnis, Grundlage für Vorschau und Export
let terms = [];     // Rohbegriffe vor Gewichtung

const canvas = $('cloudCanvas');
const ctx = canvas.getContext('2d');

/* ── Ableitungen ─────────────────────────────────────────────────── */

const ratioValue = () => {
  const [w, h] = state.ratio.split(':').map(Number);
  return w / h;
};
const designSize = () => {
  const width = BASE_WIDTH;
  return { width, height: Math.round(width / ratioValue()) };
};
const fontSpec = () => ({
  family: state.font === 'Inter' ? "Inter, system-ui, sans-serif" : state.font,
  weight: state.weight,
});
const renderOpts = () => ({
  font: fontSpec(),
  background: state.background,
  bgColor: state.bgColor,
  bgColor2: state.bgColor2,
  textColor: state.background === 'transparent' ? state.singleColor : contrastText(state.bgColor),
  mutedColor: mutedOn(state.background === 'transparent' ? '#ffffff' : state.bgColor),
});

function contrastText(bg) {
  const v = bg.replace('#', '');
  const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  // Relative Helligkeit nach WCAG — Titel bleibt lesbar, egal welcher Hintergrund.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#101114' : '#f5f6f8';
}
const mutedOn = (bg) => (contrastText(bg) === '#101114' ? '#5a5f70' : '#9aa0b4');

/* ── Begriffe aufbauen ───────────────────────────────────────────── */

function buildTerms() {
  if (state.mode === 'csv') {
    if (!state.table) return [];
    const list = rowsToTerms(state.table, state.mapping)
      .sort((a, b) => b.count - a.count)
      .slice(0, 300);
    return list.map((term) => ({ ...term, enabled: !state.excluded.has(term.label) }));
  }
  if (!state.raw.trim()) return [];
  return tokenize(state.raw, {
    lowercase: state.lowercase,
    stopwordsDe: state.stopDe,
    stopwordsEn: state.stopEn,
    customStopwords: state.customStop,
    minLength: state.minLength,
    dropNumbers: state.dropNumbers,
    ngram: state.ngram,
    maxTerms: state.maxTerms,
  }).map((term) => ({ ...term, enabled: !state.excluded.has(term.label) }));
}

/* ── Rendern ─────────────────────────────────────────────────────── */

function render() {
  clearError();
  try {
    terms = buildTerms();
  } catch (err) {
    terms = [];
    setError(err.i18nCode || 'errReadFailed');
  }

  const scored = computeScores(terms, {
    alpha: state.alpha,
    scale: state.scale,
    minFont: state.minFont,
    maxFont: state.maxFont,
  });

  renderTermsTable(scored);

  const { width, height } = designSize();
  canvas.width = width;
  canvas.height = height;

  if (!scored.length) {
    model = null;
    ctx.clearRect(0, 0, width, height);
    show($('previewEmpty'), true);
    $('status').textContent = '';
    // Eingabe da, aber alles weggefiltert: das ist ein Fehler, kein Leerzustand.
    if (state.raw.trim() && !$('error').dataset.code) setError('errNoTerms');
    updateExportHint();
    return;
  }
  show($('previewEmpty'), false);

  const frame = computeFrame({ width, height, title: state.title, subtitle: state.subtitle, source: state.source });
  const mask = buildMask({
    width: frame.area.w,
    height: frame.area.h,
    cell: MASK_CELL,
    shape: state.shape === 'image' && !state.maskImage ? 'rect' : state.shape,
    imageMask: state.shape === 'image' && state.maskImage
      ? { ...state.maskImage, threshold: state.maskThreshold, invert: state.maskInvert }
      : null,
  });

  if (freeRatio(mask) < 0.02) {
    setError('errMaskEmpty');
    return;
  }

  const laid = layoutCloud(scored, {
    mask,
    area: { w: frame.area.w, h: frame.area.h },
    padding: state.padding,
    rotation: state.rotation,
    textCase: state.textCase,
    font: fontSpec(),
    seed: state.seed,
    autoFit: true,
    recentre: state.shape === 'rect',
  });

  const placed = assignColors(laid.placed, {
    colorMode: state.colorMode,
    colors: paletteById(state.palette).colors,
    singleColor: state.singleColor,
    seed: state.seed,
  });

  model = { width, height, frame, placed };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCloud(ctx, model, renderOpts());

  const total = scored.length;
  const parts = [t('statusPlaced', { placed: placed.length, total })];
  if (laid.unplaced) parts.push(t('statusUnplaced', { n: laid.unplaced }));
  $('status').textContent = parts.join(' · ');
  canvas.setAttribute('aria-label', `${t('ariaCanvas')}: ${placed.slice(0, 12).map((p) => p.text).join(', ')}`);
  updateExportHint();
}

const renderSoon = debounce(render, 130);

/* ── Begriffstabelle ─────────────────────────────────────────────── */

function renderTermsTable(scored) {
  const body = $('termsTableBody');
  const byLabel = new Map(scored.map((s) => [s.label, s]));
  body.replaceChildren();
  for (const term of terms) {
    const scoredTerm = byLabel.get(term.label);
    const tr = document.createElement('tr');

    const useCell = document.createElement('td');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = term.enabled;
    box.setAttribute('aria-label', t('termUse', { term: term.label }));
    box.addEventListener('change', () => {
      if (box.checked) state.excluded.delete(term.label);
      else state.excluded.add(term.label);
      render();
    });
    useCell.appendChild(box);

    const cells = [
      useCell,
      cell(term.label),
      cell(format(term.count), 'num'),
      cell(format(term.weight), 'num'),
      cell(scoredTerm ? scoredTerm.score.toFixed(2) : '—', 'num'),
    ];
    cells.forEach((c) => tr.appendChild(c));
    if (!term.enabled) tr.classList.add('is-off');
    body.appendChild(tr);
  }
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}
const format = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));

/* ── Fehler und Hinweise ─────────────────────────────────────────── */

function setError(code) {
  const el = $('error');
  el.textContent = t(code);
  el.dataset.code = code;
  show(el, true);
}
function clearError() {
  const el = $('error');
  el.textContent = '';
  delete el.dataset.code;
  show(el, false);
}

function updateExportHint() {
  const { width, height } = designSize();
  const scale = exportScale();
  $('exportSizeHint').textContent = t('hintExportSize', {
    w: Math.round(width * scale),
    h: Math.round(height * scale),
  });
}

function exportScale() {
  const wanted = state.scaleFactor;
  const { width, height } = designSize();
  // Harte Obergrenze, damit kein Browser beim Export am Speicher scheitert.
  return Math.min(wanted, MAX_EXPORT_EDGE / Math.max(width, height));
}

function updateAlphaHint() {
  const el = $('alphaHint');
  if (state.alpha === 0) el.textContent = t('alphaCounts');
  else if (state.alpha === 1) el.textContent = t('alphaWeights');
  else el.textContent = t('alphaMix', { count: Math.round((1 - state.alpha) * 100), weight: Math.round(state.alpha * 100) });
  $('formulaHint').textContent = formulaText(state.alpha, state.scale, t);
}

function updateModeVisibility() {
  const csv = state.mode === 'csv';
  show($('mappingPanel'), csv && Boolean(state.table));
  show($('analysisPanel'), !csv);
  $('sourceHint').textContent = t(csv ? 'hintCsvMode' : 'hintTextMode');
  $('sourceText').placeholder = t(csv ? 'placeholderCsv' : 'placeholderText');
  show($('maskField'), state.shape === 'image');
  show($('qualityField'), state.format === 'jpeg' || state.format === 'webp');
  show($('bgColor2Field'), state.background === 'gradient');
  $('copyBtn').disabled = state.format === 'svg';
}

/* ── Dateien ─────────────────────────────────────────────────────── */

async function readTextFile(file) {
  if (file.size > MAX_FILE_BYTES) throw errorWithCode('errFileTooLarge');
  return file.text();
}

async function handleDataFile(file) {
  clearError();
  try {
    const text = await readTextFile(file);
    const looksTabular = /\.(csv|tsv)$/i.test(file.name) || /^[^\n]*[,;\t][^\n]*\n/.test(text);
    setMode(looksTabular ? 'csv' : 'text');
    $('sourceText').value = text;
    ingest(text);
  } catch (err) {
    setError(err.i18nCode || 'errReadFailed');
  }
}

/** Text übernehmen — im CSV-Modus zusätzlich zerlegen und Spalten zuordnen. */
function ingest(text) {
  state.raw = text;
  if (state.mode === 'csv') {
    try {
      state.table = parseTable(text);
      const guess = guessColumns(state.table);
      state.mapping = guess;
      fillMappingSelects();
    } catch (err) {
      state.table = null;
      setError(err.i18nCode || 'errCsvEmpty');
    }
  }
  updateModeVisibility();
  render();
}

function fillMappingSelects() {
  const { headers } = state.table;
  const build = (select, value, allowNone) => {
    select.replaceChildren();
    if (allowNone) {
      const none = document.createElement('option');
      none.value = '-1';
      none.textContent = t('colNone');
      select.appendChild(none);
    }
    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = header;
      select.appendChild(option);
    });
    select.value = String(value);
  };
  build($('colLabel'), state.mapping.label, false);
  build($('colCount'), state.mapping.count, true);
  build($('colWeight'), state.mapping.weight, true);
}

async function handleMaskFile(file) {
  clearError();
  try {
    const bitmap = await createImageBitmap(file);
    // Auf eine Arbeitsgröße herunterrechnen: die Maske braucht keine Details.
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(bitmap, 0, 0, w, h);
    const img = octx.getImageData(0, 0, w, h);
    state.maskImage = { width: w, height: h, data: img.data };
    bitmap.close?.();
    render();
  } catch {
    setError('errImageFailed');
  }
}

/* ── Export ──────────────────────────────────────────────────────── */

function exportCanvas() {
  const scale = exportScale();
  const out = document.createElement('canvas');
  out.width = Math.round(model.width * scale);
  out.height = Math.round(model.height * scale);
  const octx = out.getContext('2d');
  octx.setTransform(scale, 0, 0, scale, 0, 0);
  drawCloud(octx, model, renderOpts());
  return out;
}

async function doDownload() {
  if (!model) return;
  clearError();
  const base = state.title || 'wordcloud';
  try {
    if (state.format === 'svg') {
      const svg = buildSvg(model, { ...renderOpts(), exportScale: exportScale() });
      downloadBlob(svgToBlob(svg), safeFilename(base, 'svg'));
      return;
    }
    const blob = await canvasToBlob(exportCanvas(), state.format, state.quality);
    downloadBlob(blob, safeFilename(base, state.format === 'jpeg' ? 'jpg' : state.format));
  } catch (err) {
    setError(err.message === 'errExportFailed' ? 'errExportFailed' : 'errExportFailed');
  }
}

async function doCopy() {
  if (!model) return;
  clearError();
  try {
    await copyToClipboard(exportCanvas());
    $('status').textContent = t('copied');
  } catch (err) {
    setError(err.message === 'errClipboardUnsupported' ? 'errClipboardUnsupported' : 'errExportFailed');
  }
}

const PRESET_KEYS = ['alpha', 'scale', 'minFont', 'maxFont', 'shape', 'maskThreshold', 'maskInvert',
  'rotation', 'padding', 'ratio', 'seed', 'font', 'weight', 'textCase', 'palette', 'colorMode',
  'singleColor', 'background', 'bgColor', 'bgColor2', 'title', 'subtitle', 'source',
  'lowercase', 'stopDe', 'stopEn', 'dropNumbers', 'customStop', 'minLength', 'ngram', 'maxTerms',
  'format', 'scaleFactor', 'quality'];

function savePreset() {
  const data = { app: 'wordler', version: 1 };
  PRESET_KEYS.forEach((key) => { data[key] = state[key]; });
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), safeFilename(state.title || 'wordler-preset', 'json'));
}

async function loadPreset(file) {
  clearError();
  try {
    const data = JSON.parse(await readTextFile(file));
    if (!data || data.app !== 'wordler') throw errorWithCode('errPresetInvalid');
    PRESET_KEYS.forEach((key) => { if (key in data) state[key] = data[key]; });
    syncControlsFromState();
    render();
  } catch (err) {
    setError(err.i18nCode || 'errPresetInvalid');
  }
}

/* ── Verdrahtung ─────────────────────────────────────────────────── */

const controls = {};

function setMode(mode) {
  state.mode = mode;
  controls.mode.set(mode, true);
  updateModeVisibility();
}

function bindInput(id, key, transform = (v) => v, event = 'input') {
  const el = $(id);
  el.addEventListener(event, () => {
    state[key] = transform(el.type === 'checkbox' ? el.checked : el.value);
    if (id === 'optAlpha') updateAlphaHint();
    if (id === 'optMaxTerms') $('maxTermsHint').textContent = String(state.maxTerms);
    if (id === 'optPadding') $('paddingHint').textContent = `${state.padding} px`;
    if (id === 'optQuality') $('qualityHint').textContent = `${Math.round(state.quality * 100)} %`;
    if (id === 'optBackground' || id === 'optShape') updateModeVisibility();
    renderSoon();
  });
  return el;
}

function syncControlsFromState() {
  $('optLowercase') && controls.lowercase.set(state.lowercase, true);
  controls.stopDe.set(state.stopDe, true);
  controls.stopEn.set(state.stopEn, true);
  controls.dropNumbers.set(state.dropNumbers, true);
  controls.maskInvert.set(state.maskInvert, true);
  controls.scale.set(state.scale, true);
  controls.rotation.set(state.rotation, true);
  controls.ratio.set(state.ratio, true);
  controls.colorMode.set(state.colorMode, true);
  controls.format.set(state.format, true);
  controls.scaleFactor.set(String(state.scaleFactor), true);

  const pairs = [
    ['optCustomStop', 'customStop'], ['optMinLength', 'minLength'], ['optNgram', 'ngram'],
    ['optMaxTerms', 'maxTerms'], ['optAlpha', 'alpha'], ['optMinFont', 'minFont'],
    ['optMaxFont', 'maxFont'], ['optShape', 'shape'], ['optMaskThreshold', 'maskThreshold'],
    ['optPadding', 'padding'], ['optSeed', 'seed'], ['optFont', 'font'], ['optWeight', 'weight'],
    ['optCase', 'textCase'], ['optPalette', 'palette'], ['optSingleColor', 'singleColor'],
    ['optBackground', 'background'], ['optBgColor', 'bgColor'], ['optBgColor2', 'bgColor2'],
    ['optTitle', 'title'], ['optSubtitle', 'subtitle'], ['optSource', 'source'],
    ['optQuality', 'quality'],
  ];
  pairs.forEach(([id, key]) => { $(id).value = String(state[key]); });

  $('maxTermsHint').textContent = String(state.maxTerms);
  $('paddingHint').textContent = `${state.padding} px`;
  $('qualityHint').textContent = `${Math.round(state.quality * 100)} %`;
  updateAlphaHint();
  updateModeVisibility();
}

function fillPalettes() {
  const select = $('optPalette');
  select.replaceChildren();
  PALETTES.forEach((palette) => {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = palette.name;
    select.appendChild(option);
  });
  select.value = state.palette;
}

function wire() {
  controls.mode = bindSegmented('modeSegmented', state.mode, (value) => {
    state.mode = value;
    state.excluded.clear();
    ingest($('sourceText').value);
  });
  controls.scale = bindSegmented('scaleSegmented', state.scale, (value) => {
    state.scale = value;
    updateAlphaHint();
    renderSoon();
  });
  controls.rotation = bindSegmented('rotationSegmented', state.rotation, (value) => { state.rotation = value; renderSoon(); });
  controls.ratio = bindSegmented('ratioSegmented', state.ratio, (value) => { state.ratio = value; renderSoon(); });
  controls.colorMode = bindSegmented('colorModeSegmented', state.colorMode, (value) => { state.colorMode = value; renderSoon(); });
  controls.format = bindSegmented('formatSegmented', state.format, (value) => {
    state.format = value;
    updateModeVisibility();
    updateExportHint();
  });
  controls.scaleFactor = bindSegmented('scaleFactorSegmented', String(state.scaleFactor), (value) => {
    state.scaleFactor = Number(value);
    updateExportHint();
  });

  controls.lowercase = bindSwitch('optLowercase', state.lowercase, (v) => { state.lowercase = v; renderSoon(); });
  controls.stopDe = bindSwitch('optStopDe', state.stopDe, (v) => { state.stopDe = v; renderSoon(); });
  controls.stopEn = bindSwitch('optStopEn', state.stopEn, (v) => { state.stopEn = v; renderSoon(); });
  controls.dropNumbers = bindSwitch('optDropNumbers', state.dropNumbers, (v) => { state.dropNumbers = v; renderSoon(); });
  controls.maskInvert = bindSwitch('optMaskInvert', state.maskInvert, (v) => { state.maskInvert = v; renderSoon(); });

  $('sourceText').addEventListener('input', debounce(() => ingest($('sourceText').value), 350));

  bindInput('optCustomStop', 'customStop');
  bindInput('optMinLength', 'minLength', Number);
  bindInput('optNgram', 'ngram', Number, 'change');
  bindInput('optMaxTerms', 'maxTerms', Number);
  bindInput('optAlpha', 'alpha', Number);
  bindInput('optMinFont', 'minFont', Number);
  bindInput('optMaxFont', 'maxFont', Number);
  bindInput('optShape', 'shape', (v) => v, 'change');
  bindInput('optMaskThreshold', 'maskThreshold', Number);
  bindInput('optPadding', 'padding', Number);
  bindInput('optSeed', 'seed');
  bindInput('optFont', 'font', (v) => v, 'change');
  bindInput('optWeight', 'weight', Number, 'change');
  bindInput('optCase', 'textCase', (v) => v, 'change');
  bindInput('optPalette', 'palette', (v) => v, 'change');
  bindInput('optSingleColor', 'singleColor');
  bindInput('optBackground', 'background', (v) => v, 'change');
  bindInput('optBgColor', 'bgColor');
  bindInput('optBgColor2', 'bgColor2');
  bindInput('optTitle', 'title');
  bindInput('optSubtitle', 'subtitle');
  bindInput('optSource', 'source');
  bindInput('optQuality', 'quality', Number);

  ['colLabel', 'colCount', 'colWeight'].forEach((id) => {
    $(id).addEventListener('change', () => {
      state.mapping = {
        ...state.mapping,
        label: Number($('colLabel').value),
        count: Number($('colCount').value),
        weight: Number($('colWeight').value),
      };
      render();
    });
  });

  bindDropzone('fileDrop', 'fileInput', handleDataFile);
  bindDropzone('maskDrop', 'maskInput', handleMaskFile);
  bindDropzone('presetDrop', 'presetInput', loadPreset);

  $('rerollBtn').addEventListener('click', () => {
    state.seed = Math.random().toString(36).slice(2, 9);
    $('optSeed').value = state.seed;
    render();
  });
  $('sampleBtn').addEventListener('click', loadSample);
  $('clearBtn').addEventListener('click', () => {
    $('sourceText').value = '';
    state.table = null;
    state.excluded.clear();
    ingest('');
  });
  $('downloadBtn').addEventListener('click', doDownload);
  $('copyBtn').addEventListener('click', doCopy);
  $('presetSaveBtn').addEventListener('click', savePreset);

  const termsToggle = $('termsToggle');
  termsToggle.addEventListener('click', () => {
    const open = termsToggle.getAttribute('aria-expanded') === 'true';
    termsToggle.setAttribute('aria-expanded', String(!open));
    termsToggle.textContent = t(open ? 'btnShow' : 'btnHide');
    termsToggle.dataset.i18n = open ? 'btnShow' : 'btnHide';
    show($('termsBody'), !open);
  });
}

async function loadSample() {
  clearError();
  try {
    const response = await fetch('samples/topics.csv');
    const text = await response.text();
    setMode('csv');
    $('sourceText').value = text;
    state.excluded.clear();
    state.title = state.title || t('sampleTitle');
    $('optTitle').value = state.title;
    ingest(text);
  } catch {
    setError('errReadFailed');
  }
}

/* ── Start ───────────────────────────────────────────────────────── */

async function boot() {
  fillPalettes();
  wire();
  applyLanguage(detectInitialLang(), () => {
    updateAlphaHint();
    updateModeVisibility();
    updateExportHint();
    if (state.table) fillMappingSelects();
    if (terms.length) render();
  });
  initLangSwitch((value) => applyLanguage(value, () => {
    updateAlphaHint();
    updateModeVisibility();
    updateExportHint();
    if (state.table) fillMappingSelects();
    render();
  }));
  const initial = detectInitialLang();
  const menu = document.querySelector(`.lang-option[data-value="${initial}"]`);
  if (menu) {
    document.querySelectorAll('.lang-option').forEach((o) => o.setAttribute('aria-selected', String(o === menu)));
    $('langButtonLabel').textContent = menu.textContent;
    $('langButtonLabel').lang = menu.lang;
  }
  syncControlsFromState();

  // Canvas kann nur mit bereits geladenen Schriften messen — sonst würde die
  // erste Wolke mit der Ersatzschrift ausgemessen und säße daneben.
  try {
    await Promise.all([500, 700, 800].map((w) => document.fonts.load(`${w} 40px Inter`)));
    await document.fonts.ready;
  } catch { /* Schriftladen nicht verfügbar */ }

  render();
}

boot();
