import assert from "node:assert/strict";

import { test } from "vitest";

import { FACE, placeFaces, type Face } from "./eraFaces";

const eras = (...xs: number[]) => xs.map((x) => ({ x, labelWidth: 100 }));
const overlap = (faces: Face[]) =>
  faces.some((a, i) =>
    faces.some(
      (b, j) =>
        i < j &&
        a.row === b.row &&
        a.left < b.left + FACE &&
        b.left < a.left + FACE,
    ),
  );

test("far apart: each face centred on its era's start, every name shown", () => {
  const apart = placeFaces(eras(100, 400, 700), 1000);
  assert.deepEqual(
    apart.map((f) => f.left),
    [100 - FACE / 2, 400 - FACE / 2, 700 - FACE / 2],
  );
  assert.ok(apart.every((f) => f.label === "right"));
});

test("close together: the second face goes to the other row, no face overlaps", () => {
  const close = placeFaces(eras(100, 110, 120), 1000);
  assert.notEqual(close[0]!.row, close[1]!.row);
  assert.equal(overlap(close), false);
});

test("crowded at the right edge: all faces stay inside and apart", () => {
  const edge = placeFaces(eras(950, 960, 970, 980, 990), 1000);
  assert.equal(overlap(edge), false);
  assert.ok(edge.every((f) => f.left >= 0 && f.left + FACE <= 1000));
});

// The newest and the oldest share a row and the oldest's name would run into
// the newest's face
test("names: the newest wins the room", () => {
  const named = placeFaces(eras(100, 140, 200), 1000);
  assert.equal(named[0]!.row, named[2]!.row);
  assert.deepEqual(
    named.map((f) => f.label),
    [null, "right", "right"],
  );
});

test("at the right edge the name goes left of the face; without room on either side it is left out", () => {
  assert.equal(placeFaces(eras(950), 1000)[0]!.label, "left");
  assert.equal(placeFaces(eras(950), 120)[0]!.label, null);
});

test("the newest era is named even when an older face sits where its name goes: the older face makes way", () => {
  const crowded = placeFaces(eras(100, 860, 880, 960), 1000);
  assert.equal(crowded[3]!.label, "left");
  assert.equal(overlap(crowded), false);
});

test("a face at the very start stays apart from the others", () => {
  assert.equal(overlap(placeFaces(eras(0, 20, 40), 576)), false);
});

test("a name too long to reserve room for never piles faces up", () => {
  const long = placeFaces(
    [50, 150, 250, 350, 570].map((x, i) => ({
      x,
      labelWidth: i === 4 ? 500 : 100,
    })),
    576,
  );
  assert.equal(overlap(long), false);
  assert.ok(long.every((f) => f.left >= 0));
});

test("many eras close together: still apart, even past the right edge", () => {
  const many = placeFaces(
    Array.from({ length: 40 }, (_, i) => ({ x: i * 10, labelWidth: 100 })),
    576,
  );
  assert.equal(overlap(many), false);
});
