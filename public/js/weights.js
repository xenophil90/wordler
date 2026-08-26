// Raw numbers become a type size. The path from one to the other lives in a
// single place on purpose, because the interface prints it as a formula.

export const SCALES = ['linear', 'sqrt', 'log', 'rank'];

function normalise(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  // All values equal: every term gets the same size instead of NaN.
  if (!isFinite(span) || span === 0) return values.map(() => 1);
  return values.map((v) => (v - min) / span);
}

function shape(value, scale, rank, total) {
  switch (scale) {
    case 'sqrt': return Math.sqrt(value);
    case 'log': return Math.log1p(value * 9) / Math.LN10;
    case 'rank': return total > 1 ? 1 - rank / (total - 1) : 1;
    default: return value;
  }
}

/**
 * Adds `score` (0..1) and `fontSize` to every active term.
 * @param {{alpha:number, scale:string, minFont:number, maxFont:number}} opts
 */
export function computeScores(terms, opts) {
  const active = terms.filter((t) => t.enabled !== false);
  if (!active.length) return [];
  const alpha = Math.min(1, Math.max(0, opts.alpha));
  const nCount = normalise(active.map((t) => Number(t.count) || 0));
  const nWeight = normalise(active.map((t) => Number(t.weight) || 0));

  const blended = active.map((_, i) => (1 - alpha) * nCount[i] + alpha * nWeight[i]);
  const order = blended
    .map((v, i) => [v, i])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  const rankOf = new Array(active.length);
  order.forEach((idx, rank) => { rankOf[idx] = rank; });

  const minFont = Math.min(opts.minFont, opts.maxFont);
  const maxFont = Math.max(opts.minFont, opts.maxFont);

  return active.map((term, i) => {
    const score = Math.min(1, Math.max(0, shape(blended[i], opts.scale, rankOf[i], active.length)));
    return {
      ...term,
      score,
      rank: rankOf[i],
      fontSize: minFont + score * (maxFont - minFont),
    };
  }).sort((a, b) => b.fontSize - a.fontSize);
}

/** The plain-language formula shown in the interface. */
export function formulaText(alpha, scale, t) {
  const a = alpha.toFixed(2);
  const inner = `${(1 - alpha).toFixed(2)} · ${t('fmlCount')} + ${a} · ${t('fmlWeight')}`;
  const wrapped = {
    linear: (x) => x,
    sqrt: (x) => `√(${x})`,
    log: (x) => `log(${x})`,
    rank: () => t('fmlRankOnly'),
  }[scale] || ((x) => x);
  return `${t('fmlScore')} = ${wrapped(inner)}`;
}
