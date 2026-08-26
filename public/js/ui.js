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

/**
 * Does either table know this key at all? Only then may text in the markup be
 * overwritten: otherwise a stale i18n.js served from cache would print the key
 * name itself onto the page instead of leaving the HTML's own text in place.
 */
const knownKey = (key) => key in (TRANSLATIONS[lang] || {}) || key in TRANSLATIONS.de;

export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch { /* localStorage unavailable */ }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function applyLanguage(next, onApplied) {
  lang = TRANSLATIONS[next] ? next : 'de';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (knownKey(el.dataset.i18n)) el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    if (knownKey(el.dataset.i18nPlaceholder)) el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    if (knownKey(el.dataset.i18nAriaLabel)) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* not worth failing over */ }
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

/** A radiogroup built from buttons — arrow keys included, as a radiogroup owes you. */
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
    // Reset, so picking the same file twice in a row still fires.
    input.value = '';
  });
}

export const show = (el, visible) => el.classList.toggle('hidden', !visible);

/** Coalesce events: otherwise a slider triggers a re-layout for every pixel. */
export function debounce(fn, ms) {
  let handle = 0;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
}
