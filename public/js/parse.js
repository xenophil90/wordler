// CSV/TSV splitting. Hand-written rather than a library on purpose: the format
// is small, but the error messages have to speak the language of the app.

const DELIMITERS = [',', ';', '\t', '|'];

export function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    // Delimiters inside quotes do not count.
    const count = splitLine(line, d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

function splitLine(line, delimiter) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { quoted = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * @returns {{ headers: string[], rows: string[][], hasHeader: boolean }}
 */
export function parseTable(text, delimiter = detectDelimiter(text)) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) throw errorWithCode('errCsvEmpty');
  const rows = lines.map((l) => splitLine(l, delimiter));
  const width = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < width) r.push('');

  // Detect the header: the first row counts as one when it holds fewer numbers
  // than the rows below it do on average.
  const numericCount = (row) => row.filter((c) => isNumeric(c)).length;
  const first = numericCount(rows[0]);
  const rest = rows.slice(1);
  const avgRest = rest.length
    ? rest.reduce((sum, r) => sum + numericCount(r), 0) / rest.length
    : 0;
  const hasHeader = rows.length > 1 && first < avgRest;

  const headers = hasHeader
    ? rows[0].map((h, i) => h || `#${i + 1}`)
    : rows[0].map((_, i) => `#${i + 1}`);
  return { headers, rows: hasHeader ? rows.slice(1) : rows, hasHeader };
}

export function isNumeric(value) {
  if (typeof value !== 'string') return typeof value === 'number' && isFinite(value);
  const v = value.trim().replace(/\s/g, '');
  if (!v) return false;
  // Accept the German notation (1.234,56) as readily as the English one.
  return !Number.isNaN(toNumber(v));
}

export function toNumber(value) {
  if (typeof value === 'number') return value;
  let v = String(value).trim().replace(/\s|%/g, '');
  if (!v) return NaN;
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  if (lastComma > -1 && lastComma > lastDot) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else {
    v = v.replace(/,/g, '');
  }
  return Number(v);
}

/** Heuristic that pre-fills the column mapping. */
export function guessColumns({ headers, rows }) {
  const cols = headers.map((_, i) => i);
  const numeric = cols.filter((i) => rows.length && rows.every((r) => !r[i] || isNumeric(r[i])) && rows.some((r) => isNumeric(r[i])));
  const label = cols.find((i) => !numeric.includes(i));
  return {
    label: label === undefined ? 0 : label,
    count: numeric[0] === undefined ? -1 : numeric[0],
    weight: numeric[1] === undefined ? -1 : numeric[1],
    numeric,
  };
}

export function rowsToTerms({ rows }, mapping) {
  const terms = [];
  const seen = new Map();
  for (const row of rows) {
    const label = (row[mapping.label] || '').trim();
    if (!label) continue;
    const count = mapping.count >= 0 && isNumeric(row[mapping.count]) ? toNumber(row[mapping.count]) : 1;
    const weight = mapping.weight >= 0 && isNumeric(row[mapping.weight]) ? toNumber(row[mapping.weight]) : count;
    // Sum duplicate terms rather than drawing them twice.
    if (seen.has(label)) {
      const t = seen.get(label);
      t.count += count;
      t.weight = Math.max(t.weight, weight);
      continue;
    }
    const term = { label, count, weight, enabled: true };
    seen.set(label, term);
    terms.push(term);
  }
  if (!terms.length) throw errorWithCode('errCsvNoTerms');
  return terms;
}

export function errorWithCode(code) {
  const err = new Error(code);
  err.i18nCode = code;
  return err;
}
