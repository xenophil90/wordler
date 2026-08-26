// Shape masks. A mask is a grid over the drawing area: 1 = taken. Everything
// outside the shape is marked as taken up front, so the layout algorithm tests
// collision and staying inside the shape in one go.

export const SHAPES = ['rect', 'ellipse', 'circle', 'heart', 'star', 'diamond', 'arch'];

// Normalised coordinates: x, y ∈ [-1, 1], origin at the centre.
const TESTS = {
  rect: () => true,
  ellipse: (x, y) => x * x + y * y <= 1,
  circle: (x, y, ar) => {
    // A circle rather than an ellipse: the longer axis is squeezed onto the shorter.
    const sx = ar >= 1 ? x * ar : x;
    const sy = ar >= 1 ? y : y / ar;
    return sx * sx + sy * sy <= 1;
  },
  heart: (x, y) => {
    const hx = x * 1.25;
    const hy = -y * 1.15 + 0.35;
    const a = hx * hx + hy * hy - 1;
    return a * a * a - hx * hx * hy * hy * hy <= 0;
  },
  diamond: (x, y) => Math.abs(x) + Math.abs(y) <= 1,
  star: (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 1) return false;
    const theta = Math.atan2(y, x) + Math.PI / 2;
    // Five-pointed star as a radial wave function — cheaper than a polygon test.
    const n = 5;
    const seg = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const phase = Math.abs(((seg * n) / (2 * Math.PI)) % 1 - 0.5) * 2;
    const inner = 0.42;
    return r <= inner + (1 - inner) * Math.pow(phase, 1.6);
  },
  arch: (x, y) => {
    // Round on top, flat at the bottom — a good shape for title graphics.
    if (y > 0) return Math.abs(x) <= 1;
    return x * x + y * y * 1.6 <= 1;
  },
};

/**
 * @returns {{gw:number, gh:number, cell:number, data:Uint8Array}}
 */
export function buildMask({ width, height, cell, shape = 'rect', imageMask = null }) {
  const gw = Math.max(1, Math.ceil(width / cell));
  const gh = Math.max(1, Math.ceil(height / cell));
  const data = new Uint8Array(gw * gh);

  if (imageMask) {
    stampImageMask(data, gw, gh, imageMask);
    return { gw, gh, cell, data };
  }

  const test = TESTS[shape] || TESTS.rect;
  const ar = width / height;
  for (let gy = 0; gy < gh; gy++) {
    const ny = ((gy + 0.5) * cell / height) * 2 - 1;
    for (let gx = 0; gx < gw; gx++) {
      const nx = ((gx + 0.5) * cell / width) * 2 - 1;
      // A small inset, so letters do not cling to the edge of the picture.
      if (!test(nx * 1.02, ny * 1.02, ar)) data[gy * gw + gx] = 1;
    }
  }
  return { gw, gh, cell, data };
}

/**
 * Builds a mask from an image: dark, opaque pixels are the allowed area.
 * @param {{width:number,height:number,data:Uint8ClampedArray,invert:boolean,threshold:number}} img
 */
function stampImageMask(data, gw, gh, img) {
  const { width: iw, height: ih, data: px, invert, threshold } = img;
  // Fit the image into the area proportionally (contain); block the rest.
  const scale = Math.min(gw / iw, gh / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const offX = (gw - dw) / 2;
  const offY = (gh - dh) / 2;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const sx = Math.floor((gx - offX) / scale);
      const sy = Math.floor((gy - offY) / scale);
      if (sx < 0 || sy < 0 || sx >= iw || sy >= ih) { data[gy * gw + gx] = 1; continue; }
      const i = (sy * iw + sx) * 4;
      const alpha = px[i + 3] / 255;
      const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      // Transparent counts as light, or a PNG with alpha would always be fully taken.
      const value = alpha < 0.5 ? 1 : lum;
      const solid = invert ? value > threshold : value < threshold;
      if (!solid) data[gy * gw + gx] = 1;
    }
  }
}

/** Share of the area still free — only used to report how full a mask is. */
export function freeRatio(mask) {
  let free = 0;
  for (let i = 0; i < mask.data.length; i++) if (!mask.data[i]) free++;
  return free / mask.data.length;
}
