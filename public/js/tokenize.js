import { STOPWORDS } from '../data/stopwords.js';

// Sentence boundaries: n-grams must not be formed across them, or the result
// holds word pairs that never stood together in the text.
const SENTENCE_BREAK = /[.!?;:\n\r]+/;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’\-_]*/gu;

/**
 * @param {string} text
 * @param {{lowercase:boolean, stopwordsDe:boolean, stopwordsEn:boolean,
 *          customStopwords:string, minLength:number, dropNumbers:boolean,
 *          ngram:number, maxTerms:number}} opts
 */
export function tokenize(text, opts) {
  const stop = new Set();
  if (opts.stopwordsDe) STOPWORDS.de.forEach((w) => stop.add(w));
  if (opts.stopwordsEn) STOPWORDS.en.forEach((w) => stop.add(w));
  String(opts.customStopwords || '')
    .split(/[,\n]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .forEach((w) => stop.add(w));

  const counts = new Map();
  // The most frequent original spelling wins the display, so that "Report" and
  // "report" become one term that still looks right.
  const surface = new Map();

  const add = (key, shown) => {
    counts.set(key, (counts.get(key) || 0) + 1);
    const forms = surface.get(key) || new Map();
    forms.set(shown, (forms.get(shown) || 0) + 1);
    surface.set(key, forms);
  };

  for (const sentence of String(text).split(SENTENCE_BREAK)) {
    const raw = sentence.match(WORD) || [];
    const kept = [];
    for (const token of raw) {
      const norm = token.toLowerCase().replace(/^[-_'’]+|[-_'’]+$/g, '');
      if (!norm) continue;
      if (opts.dropNumbers && /^\p{N}+$/u.test(norm)) continue;
      if (norm.length < opts.minLength) continue;
      if (stop.has(norm)) continue;
      kept.push({ norm, shown: opts.lowercase ? norm : token });
    }
    const n = Math.max(1, Math.min(3, opts.ngram || 1));
    if (n === 1) {
      kept.forEach((t) => add(t.norm, t.shown));
    } else {
      for (let i = 0; i + n <= kept.length; i++) {
        const slice = kept.slice(i, i + n);
        add(slice.map((t) => t.norm).join(' '), slice.map((t) => t.shown).join(' '));
      }
    }
  }

  const terms = [...counts.entries()].map(([key, count]) => {
    const forms = [...surface.get(key).entries()].sort((a, b) => b[1] - a[1]);
    return { label: forms[0][0], count, weight: count, enabled: true };
  });
  terms.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return terms.slice(0, Math.max(1, opts.maxTerms || 150));
}
