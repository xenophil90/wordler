// A browser-free self-test for the logic: parsing, tokenising, weighting, shape
// masks, randomness. Anything that needs a canvas is deliberately left out.
// Run it with: node tools/selftest.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(join(root, 'public', p));

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const { parseTable, guessColumns, rowsToTerms, toNumber } = await load('js/parse.js');
const { tokenize } = await load('js/tokenize.js');
const { computeScores } = await load('js/weights.js');
const { buildMask, freeRatio } = await load('js/shapes.js');
const { makeRng } = await load('js/rng.js');

console.log('parse');
const csv = readFileSync(join(root, 'public/samples/topics.csv'), 'utf8');
const table = parseTable(csv);
check('header detected', table.hasHeader);
check('14 data rows', table.rows.length === 14, String(table.rows.length));
const mapping = guessColumns(table);
check('columns guessed', mapping.label === 0 && mapping.count === 1 && mapping.weight === 2, JSON.stringify(mapping));
const terms = rowsToTerms(table, mapping);
check('first term', terms[0].label === 'Planning');
check('semicolon detected', parseTable('W;N\na;1\nb;2').rows.length === 2);
check('tab detected', parseTable('W\tN\na\t1\nb\t2').rows.length === 2);
check('German number', near(toNumber('1.234,5'), 1234.5));
check('English number', near(toNumber('1,234.5'), 1234.5));
check('no header', parseTable('a,1\nb,2').hasHeader === false);
check('duplicates summed', rowsToTerms(parseTable('W,N\na,2\na,3'), { label: 0, count: 1, weight: -1 })[0].count === 5);
check('quoted field', parseTable('W,N\n"Planning, Phase 2",4').rows[0][0] === 'Planning, Phase 2');

console.log('tokenize');
const opts = { lowercase: true, stopwordsEn: true, minLength: 3, dropNumbers: true, ngram: 1, maxTerms: 50 };
const tokens = tokenize('The cloud is a cloud. A word, a word, a word!', opts);
check('most frequent word first', tokens[0].label === 'word' && tokens[0].count === 3, JSON.stringify(tokens[0]));
check('stop words removed', !tokens.some((t) => ['the', 'is'].includes(t.label)));
check('numbers removed', tokenize('2026 report report', opts).every((t) => t.label !== '2026'));
check('minimum length applies', tokenize('ab abc', { ...opts, stopwordsEn: false }).every((t) => t.label.length >= 3));
const bigrams = tokenize('project planning. planning project', { ...opts, stopwordsEn: false, ngram: 2 });
check('n-grams split at sentence boundary', bigrams.length === 2 && bigrams.every((t) => t.count === 1), JSON.stringify(bigrams));
check('custom stop words', tokenize('alpha beta', { ...opts, customStopwords: 'alpha' }).every((t) => t.label !== 'alpha'));
check('term cap applies', tokenize('a bb ccc dddd eeeee', { ...opts, minLength: 1, stopwordsEn: false, maxTerms: 2 }).length === 2);

console.log('weights');
const scored = computeScores(terms, { alpha: 0, scale: 'linear', minFont: 10, maxFont: 100 });
check('largest term at alpha=0', scored[0].label === 'Planning');
check('score spans 0..1', near(scored[0].score, 1) && near(scored[scored.length - 1].score, 0));
const byWeight = computeScores(terms, { alpha: 1, scale: 'linear', minFont: 10, maxFont: 100 });
check('priority shifts the order',
  byWeight.map((t) => t.label).indexOf('Automation') < scored.map((t) => t.label).indexOf('Automation'));
check('excluded terms drop out', computeScores(terms.map((t, i) => ({ ...t, enabled: i > 0 })), { alpha: 0.5, scale: 'sqrt', minFont: 10, maxFont: 100 }).length === 13);
check('equal values give equal size',
  computeScores([{ label: 'a', count: 5, weight: 5 }, { label: 'b', count: 5, weight: 5 }], { alpha: 0.5, scale: 'linear', minFont: 20, maxFont: 90 })
    .every((t) => near(t.fontSize, 90)));
check('rank scaling steps evenly',
  near(computeScores(terms, { alpha: 0.5, scale: 'rank', minFont: 0, maxFont: 1 })[1].score, 1 - 1 / (terms.length - 1)));

console.log('shapes');
const rect = buildMask({ width: 300, height: 200, cell: 2, shape: 'rect' });
check('rectangle entirely free', freeRatio(rect) > 0.999);
// buildMask() insets the shape by 2 % so letters do not cling to the edge, which
// makes the expected areas smaller by 1.02² accordingly.
const INSET = 1.02 ** 2;
const circle = buildMask({ width: 300, height: 300, cell: 2, shape: 'circle' });
check('circle fills ~pi/4', Math.abs(freeRatio(circle) - Math.PI / 4 / INSET) < 0.01, freeRatio(circle).toFixed(3));
check('heart leaves area free', freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'heart' })) > 0.3);
check('star leaves area free', freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'star' })) > 0.2);
check('diamond fills ~1/2', Math.abs(freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'diamond' })) - 0.5 / INSET) < 0.01);

console.log('rng');
check('same seed, same sequence', makeRng('x')() === makeRng('x')());
check('different seed, different sequence', makeRng('x')() !== makeRng('y')());
check('values within [0,1)', Array.from({ length: 500 }, makeRng('z')).every((v) => v >= 0 && v < 1));

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
