import { expect, test } from "vitest";

import { fitLines, type Measure } from "./fitLines";

// Every character is half the font size wide
const measure: Measure = (text, size) => text.length * size * 0.5;

test("fits on one line at the largest size", () => {
  expect(fitLines("petal", 100, 2, [40, 30], measure)).toStrictEqual({
    size: 40,
    lines: ["petal"],
  });
});

test("wraps before it shrinks", () => {
  // 10 chars × 20 = 200 > 120, two lines fit
  expect(fitLines("Ariana Grande", 120, 2, [40, 30], measure)).toStrictEqual({
    size: 40,
    lines: ["Ariana", "Grande"],
  });
});

test("shrinks when two lines are not enough at the largest size", () => {
  expect(
    fitLines("hate that i made you love me", 160, 2, [40, 20], measure),
  ).toStrictEqual({ size: 20, lines: ["hate that i made", "you love me"] });
});

test("cuts the last line only when even the smallest size does not fit", () => {
  const long = fitLines("aaaa bbbb cccc dddd eeee", 50, 2, [20], measure);
  expect(long.size).toBe(20);
  expect(long.lines).toStrictEqual(["aaaa", "bbbb…"]);
  for (const line of long.lines) {
    expect(measure(line, 20)).toBeLessThanOrEqual(50);
  }
});

test("one word longer than the line is cut, never overflows", () => {
  const word = fitLines("Supercalifragilistic", 50, 2, [20], measure);
  expect(word.lines).toStrictEqual(["Supe…"]);
  expect(measure(word.lines[0]!, 20)).toBeLessThanOrEqual(50);
});
