// Run: node scripts/fitLines.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { fitLines } from "../src/scenes/Recap/fitLines.ts";

// Every character is half the font size wide
const measure = (text, size) => text.length * size * 0.5;

// Fits on one line at the largest size
assert.deepEqual(fitLines("petal", 100, 2, [40, 30], measure), {
  size: 40,
  lines: ["petal"],
});
// Wraps before it shrinks: 10 chars × 20 = 200 > 120, two lines fit
assert.deepEqual(fitLines("Ariana Grande", 120, 2, [40, 30], measure), {
  size: 40,
  lines: ["Ariana", "Grande"],
});
// Shrinks when two lines are not enough at the largest size
assert.deepEqual(
  fitLines("hate that i made you love me", 160, 2, [40, 20], measure),
  { size: 20, lines: ["hate that i made", "you love me"] },
);
// Cuts the last line only when even the smallest size does not fit
const long = fitLines("aaaa bbbb cccc dddd eeee", 50, 2, [20], measure);
assert.equal(long.size, 20);
assert.deepEqual(long.lines, ["aaaa", "bbbb…"]);
assert.ok(long.lines.every((line) => measure(line, 20) <= 50));
// One word longer than the line is cut, never overflows
const word = fitLines("Supercalifragilistic", 50, 2, [20], measure);
assert.deepEqual(word.lines, ["Supe…"]);
assert.ok(measure(word.lines[0], 20) <= 50);

console.log("fitLines: ok");
