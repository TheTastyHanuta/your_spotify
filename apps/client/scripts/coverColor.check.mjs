// Run: node scripts/coverColor.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import {
  dominantColor,
  oklchToRgb,
  rgbToOklch,
  shadeOf,
  tintFor,
} from "../src/services/coverColor.ts";

const fill = (rgb, n, a = 255) =>
  Array.from({ length: n }, () => [...rgb, a]).flat();
const orange = [217, 105, 60];

// Greys don't vote
assert.equal(dominantColor(fill([128, 128, 128], 100)), null);
// The coloured part wins even when greys are the majority
assert.deepEqual(
  dominantColor([...fill([40, 40, 40], 300), ...fill(orange, 50)]),
  orange,
);
// Transparent pixels are ignored
assert.equal(dominantColor(fill(orange, 10, 0)), null);
// Lightness is fixed per mode, chroma capped, hue kept
assert.match(tintFor(orange, "dark").deep, /^oklch\(0\.32 0\.090 \d/);
assert.match(tintFor(orange, "light").deep, /^oklch\(0\.9 0\.050 \d/);
// No colour → neutral grey
assert.equal(tintFor(null, "dark").tint, "oklch(0.72 0.000 0.0)");
// OKLCH round trip within a unit per channel
const back = (() => {
  const { l, c, h } = rgbToOklch(orange);
  return oklchToRgb(l, c, h);
})();
back.forEach((v, i) => assert.ok(Math.abs(v - orange[i]) <= 1, `${back}`));
assert.equal(shadeOf(null, [0, 0.1]), "rgb(0, 0, 0)");
console.log("coverColor ok");
