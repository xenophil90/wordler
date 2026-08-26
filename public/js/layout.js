import { makeRng } from './rng.js';

// Spiral-Platzierung mit Bitmasken, angelehnt an das Verfahren von d3-cloud,
// aber eigenständig: pro Begriff entsteht ein Sprite, dessen Deckung gegen ein
// gemeinsames Belegungsraster geprüft wird. Der Mindestabstand wird als
// Kontur (strokeText) in das Sprite eingebacken, statt später addiert zu werden.

const ROTATIONS = {
  none: () => 0,
  right: (rng) => (rng() < 0.5 ? 0 : -Math.PI / 2),
  mixed: (rng) => ((rng() * 2 - 1) * 60 * Math.PI) / 180,
  free: (rng) => ((rng() * 2 - 1) * 90 * Math.PI) / 180,
};

export function applyCase(text, mode) {
  if (mode === 'upper') return text.toLocaleUpperCase();
  if (mode === 'lower') return text.toLocaleLowerCase();
  if (mode === 'title') {
    return text.replace(/\p{L}[\p{L}'’-]*/gu, (w) => w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase());
  }
  return text;
}

function makeScratch() {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(64, 64)
    : document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
}

function buildSprite(scratch, text, fontSize, angle, padding, fontSpec, cell) {
  const { canvas, ctx } = scratch;
  ctx.font = `${fontSpec.weight} ${fontSize}px ${fontSpec.family}`;
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || fontSize * 0.8;
  const desc = m.actualBoundingBoxDescent || fontSize * 0.25;
  const w = m.width;
  const h = Math.max(asc + desc, fontSize);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  // Grosszügiger Rand: die Maske entsteht aus echten Pixeln, überzähliger
  // Platz kostet nur leere Zellen, zu wenig Platz würde Buchstaben abschneiden.
  const margin = padding + fontSize * 0.35 + 4;
  const cw = Math.ceil(w * cos + h * sin + margin * 2);
  const ch = Math.ceil(w * sin + h * cos + margin * 2);

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  } else {
    ctx.clearRect(0, 0, cw, ch);
  }
  ctx.save();
  ctx.font = `${fontSpec.weight} ${fontSize}px ${fontSpec.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(angle);
  if (padding > 0) {
    ctx.lineWidth = padding * 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = '#000';
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const px = ctx.getImageData(0, 0, cw, ch).data;
  const mw = Math.ceil(cw / cell);
  const mh = Math.ceil(ch / cell);
  const mask = new Uint8Array(mw * mh);
  for (let y = 0; y < ch; y++) {
    const row = (y / cell) | 0;
    for (let x = 0; x < cw; x++) {
      if (px[(y * cw + x) * 4 + 3] > 64) mask[row * mw + ((x / cell) | 0)] = 1;
    }
  }
  return { mask, mw, mh, cw, ch };
}

function fits(sprite, grid, gw, gh, ox, oy) {
  const { mask, mw, mh } = sprite;
  if (ox < 0 || oy < 0 || ox + mw > gw || oy + mh > gh) return false;
  for (let y = 0; y < mh; y++) {
    const gRow = (oy + y) * gw + ox;
    const mRow = y * mw;
    for (let x = 0; x < mw; x++) {
      if (mask[mRow + x] && grid[gRow + x]) return false;
    }
  }
  return true;
}

function stamp(sprite, grid, gw, ox, oy) {
  const { mask, mw, mh } = sprite;
  for (let y = 0; y < mh; y++) {
    const gRow = (oy + y) * gw + ox;
    const mRow = y * mw;
    for (let x = 0; x < mw; x++) if (mask[mRow + x]) grid[gRow + x] = 1;
  }
}

/**
 * @param {Array} terms  Ergebnis aus computeScores(), absteigend nach fontSize
 * @param {{mask:object, area:{w:number,h:number}, padding:number, rotation:string,
 *          textCase:string, font:{family:string,weight:number}, seed:string,
 *          autoFit:boolean}} opts
 * @returns {{placed:Array, unplaced:number, scale:number}}
 */
function fillRatio(placed, area) {
  if (!placed.length) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x - p.w / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    minY = Math.min(minY, p.y - p.h / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  return Math.max((maxX - minX) / area.w, (maxY - minY) / area.h);
}

/**
 * Sucht den größten Maßstab, bei dem noch alle Begriffe passen. Ohne diese
 * Suche hinge das Ergebnis an den absoluten Schriftgrößen: dieselbe Einstellung
 * ergäbe bei 14 Begriffen eine überfüllte und bei 200 eine verlorene Wolke.
 */
export function layoutCloud(terms, opts) {
  const scratch = makeScratch();
  if (!opts.autoFit) {
    return recentre({ ...runPass(scratch, terms, opts, 1), scale: 1 }, opts);
  }

  let lo = 0;        // größter Maßstab, bei dem alles passte
  let hi = Infinity; // kleinster Maßstab, bei dem etwas fehlte
  let scale = 1;
  let best = null;     // vollständige Wolke, möglichst groß
  let fallback = null; // falls nie alles passt: die vollste Wolke

  for (let attempt = 0; attempt < 8; attempt++) {
    const result = runPass(scratch, terms, opts, scale);
    if (!fallback || result.placed.length > fallback.placed.length) fallback = { ...result, scale };

    if (result.unplaced) {
      hi = scale;
      const next = Math.max(lo * 1.02, scale * 0.85);
      if (best && next <= best.scale * 1.02) break;
      if (next <= 0.3) break;
      scale = next;
      continue;
    }

    if (!best || scale > best.scale) best = { ...result, scale };
    const fill = fillRatio(result.placed, opts.area);
    if (fill > 0.9) break;
    lo = scale;
    // Der Zielfüllgrad liegt bei ~95 %; der Sprung wird gedeckelt, damit ein
    // sehr leeres Zwischenergebnis nicht über das Ziel hinausschießt.
    const grow = Math.min(1.6, 0.95 / Math.max(fill, 0.15));
    const next = Math.min(isFinite(hi) ? hi * 0.98 : Infinity, scale * grow);
    if (next <= scale * 1.02) break;
    scale = next;
  }
  return recentre(best || fallback, opts);
}

/**
 * Verschiebt die fertige Wolke so, dass ihr Umriss mittig in der Fläche sitzt.
 * Die Spirale startet zwar in der Mitte, endet aber je nach Wortbreiten schief.
 * Nur bei der Rechteckform erlaubt: bei einer Maske würde jede Verschiebung die
 * Wörter aus der Form heraustragen.
 */
function recentre(result, opts) {
  if (!opts.recentre || !result || !result.placed.length) return result;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of result.placed) {
    minX = Math.min(minX, p.x - p.w / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    minY = Math.min(minY, p.y - p.h / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  const dx = opts.area.w / 2 - (minX + maxX) / 2;
  const dy = opts.area.h / 2 - (minY + maxY) / 2;
  return { ...result, placed: result.placed.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
}

function runPass(scratch, terms, opts, scale) {
  const { mask, area, padding, rotation, textCase, font } = opts;
  const { gw, gh, cell } = mask;
  const grid = Uint8Array.from(mask.data);
  const rng = makeRng(opts.seed);
  const rotate = ROTATIONS[rotation] || ROTATIONS.none;

  const placed = [];
  let unplaced = 0;
  const aspect = area.w / area.h;
  const centreX = area.w / 2;
  const centreY = area.h / 2;
  const maxRadius = Math.hypot(gw, gh) / 2 + 4;

  for (const term of terms) {
    const text = applyCase(term.label, textCase);
    const fontSize = Math.max(6, term.fontSize * scale);
    const angle = rotate(rng);
    const sprite = buildSprite(scratch, text, fontSize, angle, padding, font, cell);

    // Jeder Begriff startet leicht versetzt, sonst legen sich gleich große
    // Wörter in sichtbaren Ringen um die Mitte.
    const startTheta = rng() * Math.PI * 2;
    const jitterX = (rng() - 0.5) * area.w * 0.04;
    const jitterY = (rng() - 0.5) * area.h * 0.04;

    let found = null;
    for (let step = 0; ; step++) {
      const theta = startTheta + step * 0.12;
      const r = 0.35 * (theta - startTheta);
      if (r > maxRadius) break;
      // Elliptische Spirale: sie dehnt sich entlang der längeren Kante, damit
      // breite Formate nicht mit einem runden Fleck in der Mitte enden.
      const cx = centreX + jitterX + r * cell * Math.cos(theta) * (aspect >= 1 ? aspect : 1);
      const cy = centreY + jitterY + r * cell * Math.sin(theta) * (aspect < 1 ? 1 / aspect : 1);
      const ox = Math.round((cx - sprite.cw / 2) / cell);
      const oy = Math.round((cy - sprite.ch / 2) / cell);
      if (fits(sprite, grid, gw, gh, ox, oy)) { found = { ox, oy }; break; }
    }

    if (!found) { unplaced++; continue; }
    stamp(sprite, grid, gw, found.ox, found.oy);
    placed.push({
      ...term,
      text,
      fontSize,
      angle,
      x: found.ox * cell + sprite.cw / 2,
      y: found.oy * cell + sprite.ch / 2,
      w: sprite.cw,
      h: sprite.ch,
    });
  }
  return { placed, unplaced };
}
