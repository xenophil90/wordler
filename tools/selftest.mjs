// Selbsttest für die Logik ohne Browser: Parsen, Tokenisieren, Gewichten,
// Formmasken, Zufall. Alles, was Canvas braucht, ist hier bewusst nicht dabei.
// Aufruf: node tools/selftest.mjs
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
check('Kopfzeile erkannt', table.hasHeader);
check('14 Datenzeilen', table.rows.length === 14, String(table.rows.length));
const mapping = guessColumns(table);
check('Spalten geraten', mapping.label === 0 && mapping.count === 1 && mapping.weight === 2, JSON.stringify(mapping));
const terms = rowsToTerms(table, mapping);
check('erster Begriff', terms[0].label === 'Planning');
check('Semikolon erkannt', parseTable('W;N\na;1\nb;2').rows.length === 2);
check('Tabulator erkannt', parseTable('W\tN\na\t1\nb\t2').rows.length === 2);
check('Zahl deutsch', near(toNumber('1.234,5'), 1234.5));
check('Zahl englisch', near(toNumber('1,234.5'), 1234.5));
check('Kopfzeile fehlt', parseTable('a,1\nb,2').hasHeader === false);
check('Doppelte summiert', rowsToTerms(parseTable('W,N\na,2\na,3'), { label: 0, count: 1, weight: -1 })[0].count === 5);
check('Anführungszeichen', parseTable('W,N\n"Planning, Phase 2",4').rows[0][0] === 'Planning, Phase 2');

console.log('tokenize');
const opts = { lowercase: true, stopwordsEn: true, minLength: 3, dropNumbers: true, ngram: 1, maxTerms: 50 };
const tokens = tokenize('The cloud is a cloud. A word, a word, a word!', opts);
check('häufigstes Wort zuerst', tokens[0].label === 'word' && tokens[0].count === 3, JSON.stringify(tokens[0]));
check('Stoppwörter entfernt', !tokens.some((t) => ['the', 'is'].includes(t.label)));
check('Zahlen entfernt', tokenize('2026 report report', opts).every((t) => t.label !== '2026'));
check('Mindestlänge greift', tokenize('ab abc', { ...opts, stopwordsEn: false }).every((t) => t.label.length >= 3));
const bigrams = tokenize('project planning. planning project', { ...opts, stopwordsEn: false, ngram: 2 });
check('N-Gramme über Satzgrenze getrennt', bigrams.length === 2 && bigrams.every((t) => t.count === 1), JSON.stringify(bigrams));
check('Eigene Stoppwörter', tokenize('alpha beta', { ...opts, customStopwords: 'alpha' }).every((t) => t.label !== 'alpha'));
check('Obergrenze greift', tokenize('a bb ccc dddd eeeee', { ...opts, minLength: 1, stopwordsEn: false, maxTerms: 2 }).length === 2);

console.log('weights');
const scored = computeScores(terms, { alpha: 0, scale: 'linear', minFont: 10, maxFont: 100 });
check('größter Begriff bei α=0', scored[0].label === 'Planning');
check('Score-Spanne 0..1', near(scored[0].score, 1) && near(scored[scored.length - 1].score, 0));
const byWeight = computeScores(terms, { alpha: 1, scale: 'linear', minFont: 10, maxFont: 100 });
check('Priorität verschiebt die Reihenfolge',
  byWeight.map((t) => t.label).indexOf('Automation') < scored.map((t) => t.label).indexOf('Automation'));
check('Abgewählte fallen raus', computeScores(terms.map((t, i) => ({ ...t, enabled: i > 0 })), { alpha: 0.5, scale: 'sqrt', minFont: 10, maxFont: 100 }).length === 13);
check('Gleiche Werte ergeben gleiche Größe',
  computeScores([{ label: 'a', count: 5, weight: 5 }, { label: 'b', count: 5, weight: 5 }], { alpha: 0.5, scale: 'linear', minFont: 20, maxFont: 90 })
    .every((t) => near(t.fontSize, 90)));
check('Rang-Skalierung ist gleichmäßig',
  near(computeScores(terms, { alpha: 0.5, scale: 'rank', minFont: 0, maxFont: 1 })[1].score, 1 - 1 / (terms.length - 1)));

console.log('shapes');
const rect = buildMask({ width: 300, height: 200, cell: 2, shape: 'rect' });
check('Rechteck komplett frei', freeRatio(rect) > 0.999);
// buildMask() zieht die Form um 2 % ein, damit Buchstaben nicht am Rand kleben;
// die erwarteten Flächen sind entsprechend um 1.02² kleiner.
const INSET = 1.02 ** 2;
const circle = buildMask({ width: 300, height: 300, cell: 2, shape: 'circle' });
check('Kreis füllt ~π/4', Math.abs(freeRatio(circle) - Math.PI / 4 / INSET) < 0.01, freeRatio(circle).toFixed(3));
check('Herz lässt Fläche frei', freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'heart' })) > 0.3);
check('Stern lässt Fläche frei', freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'star' })) > 0.2);
check('Raute füllt ~1/2', Math.abs(freeRatio(buildMask({ width: 300, height: 300, cell: 2, shape: 'diamond' })) - 0.5 / INSET) < 0.01);

console.log('rng');
check('gleicher Seed, gleiche Folge', makeRng('x')() === makeRng('x')());
check('anderer Seed, andere Folge', makeRng('x')() !== makeRng('y')());
check('Werte in [0,1)', Array.from({ length: 500 }, makeRng('z')).every((v) => v >= 0 && v < 1));

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(failures ? 1 : 0);
