// Picks a cover's main colour and derives the page tint from it.
// Checked by scripts/coverColor.check.mjs, so no imports and only
// TypeScript that Node can strip.

export type Rgb = [number, number, number];
export type ColorMode = "dark" | "light";
export type Tint = { tint: string; deep: string; mid: string; bar: string };

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

// OKLCH after Björn Ottosson's OKLab
export function rgbToOklch([r, g, b]: Rgb) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

// Pixels vote for one of 12 hue ranges, weighted by how colourful they are.
// Greys, near-black, near-white and transparent pixels don't vote. Returns
// the average colour of the winning range.
export function dominantColor(pixels: ArrayLike<number>): Rgb | null {
  const buckets = Array.from({ length: 12 }, () => ({
    w: 0,
    r: 0,
    g: 0,
    b: 0,
  }));
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) continue;
    const rgb: Rgb = [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
    const { l, c, h } = rgbToOklch(rgb);
    if (c < 0.04 || l < 0.15 || l > 0.95) continue;
    const bucket = buckets[Math.floor(h / 30) % 12];
    if (!bucket) continue;
    bucket.w += c;
    bucket.r += rgb[0] * c;
    bucket.g += rgb[1] * c;
    bucket.b += rgb[2] * c;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w === 0) return null;
  return [
    Math.round(best.r / best.w),
    Math.round(best.g / best.w),
    Math.round(best.b / best.w),
  ];
}

// [lightness, max chroma] per variable, chosen so hero text keeps AA contrast
const LEVELS = {
  dark: {
    tint: [0.72, 0.14],
    deep: [0.32, 0.09],
    mid: [0.2, 0.05],
    bar: [0.3, 0.05],
  },
  light: {
    tint: [0.52, 0.14],
    deep: [0.9, 0.05],
    mid: [0.95, 0.03],
    bar: [0.88, 0.05],
  },
} as const;

export function tintFor(rgb: Rgb | null, mode: ColorMode): Tint {
  const { c, h } = rgb ? rgbToOklch(rgb) : { c: 0, h: 0 };
  const make = ([l, max]: readonly [number, number]) =>
    `oklch(${l} ${Math.min(c, max).toFixed(3)} ${h.toFixed(1)})`;
  const lv = LEVELS[mode];
  return {
    tint: make(lv.tint),
    deep: make(lv.deep),
    mid: make(lv.mid),
    bar: make(lv.bar),
  };
}
