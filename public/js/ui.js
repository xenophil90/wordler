import { TRANSLATIONS } from '../data/i18n.js';

const LANG_KEY = 'wordler-lang';
let lang = 'de';

export const $ = (id) => document.getElementById(id);

export function t(key, params) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.de;
  let text = dict[key] ?? TRANSLATIONS.de[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

export const currentLang = () => lang;

export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch { /* localStorage nicht verfügbar */ }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function applyLanguage(next, onApplied) {
  lang = TRANSLATIONS[next] ? next : 'de';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* egal */ }
  if (onApplied) onApplied();
}

export function initLangSwitch(onChange) {
  const button = $('langButton');
  const label = $('langButtonLabel');
  const menu = $('langMenu');
  const options = [...menu.querySelectorAll('.lang-option')];

  const close = () => {
    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    (options.find((o) => o.getAttribute('aria-selected') === 'true') || options[0]).focus();
  };
  const pick = (value) => {
    options.forEach((o) => o.setAttribute('aria-selected', String(o.dataset.value === value)));
    const chosen = options.find((o) => o.dataset.value === value) || options[0];
    label.textContent = chosen.textContent;
    label.lang = chosen.lang;
    close();
    onChange(value);
  };

  button.addEventListener('click', () => {
    menu.classList.contains('hidden') ? open() : close();
  });
  options.forEach((option, index) => {
    option.addEventListener('click', () => { pick(option.dataset.value); button.focus(); });
    option.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(option.dataset.value); button.focus(); }
      if (e.key === 'Escape') { close(); button.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); options[(index + 1) % options.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); options[(index - 1 + options.length) % options.length].focus(); }
    });
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== button && !button.contains(e.target)) close();
  });
  return { select: (value) => pick(value) };
}

/** Radiogroup aus Buttons — Pfeiltasten inklusive, wie von einer Radiogruppe erwartet. */
export function bindSegmented(id, initial, onChange) {
  const group = $(id);
  const buttons = [...group.querySelectorAll('.segmented-btn')];
  let value = initial;

  const paint = () => {
    buttons.forEach((b) => {
      const on = b.dataset.value === value;
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('is-active', on);
      b.tabIndex = on ? 0 : -1;
    });
    if (!buttons.some((b) => b.tabIndex === 0) && buttons[0]) buttons[0].tabIndex = 0;
  };
  const set = (next, silent) => {
    if (!buttons.some((b) => b.dataset.value === next)) return;
    value = next;
    paint();
    if (!silent) onChange(value);
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => set(button.dataset.value));
    button.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = buttons[(index + dir + buttons.length) % buttons.length];
      set(next.dataset.value);
      next.focus();
    });
  });
  paint();
  return { get: () => value, set };
}

export function bindSwitch(id, initial, onChange) {
  const el = $(id);
  let value = initial;
  const paint = () => {
    el.setAttribute('aria-checked', String(value));
    el.classList.toggle('is-on', value);
  };
  const set = (next, silent) => {
    value = Boolean(next);
    paint();
    if (!silent) onChange(value);
  };
  el.addEventListener('click', () => set(!value));
  paint();
  return { get: () => value, set };
}

export function bindDropzone(zoneId, inputId, onFile) {
  const zone = $(zoneId);
  const input = $(inputId);
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  zone.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (e) => { stop(e); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (e) => { stop(e); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
  input.addEventListener('change', () => {
    if (input.files?.[0]) onFile(input.files[0]);
    // Zurücksetzen, damit dieselbe Datei zweimal hintereinander funktioniert.
    input.value = '';
  });
}

export const show = (el, visible) => el.classList.toggle('hidden', !visible);

/** Ereignisse zusammenfassen: ein Regler feuert sonst pro Pixel ein Neulayout. */
export function debounce(fn, ms) {
  let handle = 0;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
}
