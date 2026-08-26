import { makeRng } from './rng.js';

// Canvas and SVG render from the same placement list. That is the only way the
// raster and the vector output are guaranteed to match.

const hex = (c) => {
  const v = c.replace('#', '');
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
};

const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

export function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return toHex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t));
}

/** A ramp across a whole palette; 1 = the most important term. */
export function sampleRamp(colors, t) {
  if (colors.length === 1) return colors[0];
  const pos = (1 - Math.min(1, Math.max(0, t))) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(pos));
  return mix(colors[i], colors[i + 1], pos - i);
}

export function assignColors(placed, opts) {
  const rng = makeRng(opts.seed + ':colors');
  const colors = opts.colors.length ? opts.colors : ['#ffffff'];
  return placed.map((p, i) => {
    let color;
    switch (opts.colorMode) {
      case 'single': color = opts.singleColor; break;
      case 'random': color = colors[Math.floor(rng() * colors.length)]; break;
      case 'rank': color = colors[i % colors.length]; break;
      default: color = sampleRamp(colors, p.score);
    }
    return { ...p, color };
  });
}

/**
 * Splits the drawing area into text bands and the cloud area.
 * Both renderers use the same split.
 */
export function computeFrame({ width, height, title, subtitle, source }) {
  const margin = Math.round(width * 0.045);
  const titleSize = Math.round(width * 0.042);
  const subtitleSize = Math.round(width * 0.022);
  const sourceSize = Math.round(width * 0.016);
  let top = margin;
  const bands = [];
  if (title) {
    bands.push({ role: 'title', text: title, size: titleSize, y: top + titleSize * 0.8 });
    top += titleSize * 1.25;
  }
  if (subtitle) {
    bands.push({ role: 'subtitle', text: subtitle, size: subtitleSize, y: top + subtitleSize * 0.9 });
    top += subtitleSize * 1.9;
  }
  if (title || subtitle) top += margin * 0.4;

  let bottom = height - margin;
  if (source) {
    bands.push({ role: 'source', text: source, size: sourceSize, y: bottom });
    bottom -= sourceSize * 2;
  }
  return {
    margin,
    bands,
    area: { x: margin, y: top, w: width - margin * 2, h: Math.max(40, bottom - top) },
  };
}

function paintBackground(ctx, opts, width, height) {
  if (opts.background === 'transparent') return;
  if (opts.background === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, opts.bgColor);
    g.addColorStop(1, opts.bgColor2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = opts.bgColor;
  }
  ctx.fillRect(0, 0, width, height);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{placed:Array, frame:object, width:number, height:number}} model
 */
export function drawCloud(ctx, model, opts) {
  const { width, height, frame, placed } = model;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  paintBackground(ctx, opts, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const band of frame.bands) {
    ctx.save();
    ctx.fillStyle = band.role === 'title' ? opts.textColor : opts.mutedColor;
    ctx.font = `${band.role === 'title' ? 800 : 500} ${band.size}px ${opts.font.family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(band.text, width / 2, band.y);
    ctx.restore();
  }

  ctx.textBaseline = 'middle';
  for (const word of placed) {
    ctx.save();
    ctx.translate(frame.area.x + word.x, frame.area.y + word.y);
    ctx.rotate(word.angle);
    ctx.fillStyle = word.color;
    ctx.font = `${opts.font.weight} ${word.fontSize}px ${opts.font.family}`;
    ctx.fillText(word.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));

export function buildSvg(model, opts) {
  const { width, height, frame, placed } = model;
  const scale = opts.exportScale || 1;
  const parts = [];
  // The viewBox stays in design units and only the output size scales, which
  // keeps the vector identical to the PNG at any resolution.
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${round(width * scale)}" height="${round(height * scale)}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(opts.font.family)}">`);
  if (opts.background === 'gradient') {
    parts.push(`<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${opts.bgColor}"/><stop offset="1" stop-color="${opts.bgColor2}"/></linearGradient></defs>`);
    parts.push(`<rect width="${width}" height="${height}" fill="url(#bg)"/>`);
  } else if (opts.background !== 'transparent') {
    parts.push(`<rect width="${width}" height="${height}" fill="${opts.bgColor}"/>`);
  }
  for (const band of frame.bands) {
    const fill = band.role === 'title' ? opts.textColor : opts.mutedColor;
    parts.push(`<text x="${width / 2}" y="${round(band.y)}" fill="${fill}" font-size="${band.size}" font-weight="${band.role === 'title' ? 800 : 500}" text-anchor="middle">${escapeXml(band.text)}</text>`);
  }
  for (const word of placed) {
    const x = round(frame.area.x + word.x);
    const y = round(frame.area.y + word.y);
    const deg = round((word.angle * 180) / Math.PI);
    const transform = deg ? ` transform="rotate(${deg} ${x} ${y})"` : '';
    parts.push(`<text x="${x}" y="${y}" fill="${word.color}" font-size="${round(word.fontSize)}" font-weight="${opts.font.weight}" text-anchor="middle" dominant-baseline="central"${transform}>${escapeXml(word.text)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

const round = (n) => Math.round(n * 100) / 100;
