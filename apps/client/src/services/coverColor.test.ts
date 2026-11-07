import { expect, test } from "vitest";

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
  expect(dominantColor(fill([128, 128, 128], 100))).toBe(null);
});

test("the coloured part wins even when greys are the majority", () => {
  expect(
    dominantColor([...fill([40, 40, 40], 300), ...fill(orange, 50)]),
  ).toStrictEqual(orange);
});

test("transparent pixels are ignored", () => {
  expect(dominantColor(fill(orange, 10, 0))).toBe(null);
});

test("lightness is fixed per mode, chroma capped, hue kept", () => {
  expect(tintFor(orange, "dark").deep).toMatch(/^oklch\(0\.32 0\.090 \d/);
  expect(tintFor(orange, "light").deep).toMatch(/^oklch\(0\.9 0\.050 \d/);
});

test("no colour gives a neutral grey", () => {
  expect(tintFor(null, "dark").tint).toBe("oklch(0.72 0.000 0.0)");
  expect(shadeOf(null, [0, 0.1])).toBe("rgb(0, 0, 0)");
});

test("OKLCH round trip within a unit per channel", () => {
  const { l, c, h } = rgbToOklch(orange);
  const back = oklchToRgb(l, c, h);
  back.forEach((v, i) =>
    expect(Math.abs(v - orange[i]!)).toBeLessThanOrEqual(1),
  );
});
