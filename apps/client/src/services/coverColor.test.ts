import assert from "node:assert/strict";

import { test } from "vitest";

import {
  dominantColor,
  oklchToRgb,
  rgbToOklch,
  shadeOf,
  tintFor,
  type Rgb,
} from "./coverColor";

const fill = (rgb: Rgb, n: number, a = 255) =>
  Array.from({ length: n }, () => [...rgb, a]).flat();
const orange: Rgb = [217, 105, 60];

test("greys don't vote", () => {
  assert.equal(dominantColor(fill([128, 128, 128], 100)), null);
});

test("the coloured part wins even when greys are the majority", () => {
  assert.deepEqual(
    dominantColor([...fill([40, 40, 40], 300), ...fill(orange, 50)]),
    orange,
  );
});

test("transparent pixels are ignored", () => {
  assert.equal(dominantColor(fill(orange, 10, 0)), null);
});

test("lightness is fixed per mode, chroma capped, hue kept", () => {
  assert.match(tintFor(orange, "dark").deep, /^oklch\(0\.32 0\.090 \d/);
  assert.match(tintFor(orange, "light").deep, /^oklch\(0\.9 0\.050 \d/);
});

test("no colour gives a neutral grey", () => {
  assert.equal(tintFor(null, "dark").tint, "oklch(0.72 0.000 0.0)");
  assert.equal(shadeOf(null, [0, 0.1]), "rgb(0, 0, 0)");
});

test("OKLCH round trip within a unit per channel", () => {
  const { l, c, h } = rgbToOklch(orange);
  const back = oklchToRgb(l, c, h);
  back.forEach((v, i) => assert.ok(Math.abs(v - orange[i]!) <= 1, `${back}`));
});
