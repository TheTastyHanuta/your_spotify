import { expect, test } from "vitest";

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
  expect(apart.map((f) => f.left)).toStrictEqual([
    100 - FACE / 2,
    400 - FACE / 2,
    700 - FACE / 2,
  ]);
  expect(apart.map((f) => f.label)).toStrictEqual(["right", "right", "right"]);
});

test("close together: the second face goes to the other row, no face overlaps", () => {
  const close = placeFaces(eras(100, 110, 120), 1000);
  expect(close[0]!.row).not.toBe(close[1]!.row);
  expect(overlap(close)).toBe(false);
});

test("crowded at the right edge: all faces stay inside and apart", () => {
  const edge = placeFaces(eras(950, 960, 970, 980, 990), 1000);
  expect(overlap(edge)).toBe(false);
  for (const f of edge) {
    expect(f.left).toBeGreaterThanOrEqual(0);
    expect(f.left + FACE).toBeLessThanOrEqual(1000);
  }
});

// The newest and the oldest share a row and the oldest's name would run into
// the newest's face
test("names: the newest wins the room", () => {
  const named = placeFaces(eras(100, 140, 200), 1000);
  expect(named[0]!.row).toBe(named[2]!.row);
  expect(named.map((f) => f.label)).toStrictEqual([null, "right", "right"]);
});

test("at the right edge the name goes left of the face; without room on either side it is left out", () => {
  expect(placeFaces(eras(950), 1000)[0]!.label).toBe("left");
  expect(placeFaces(eras(950), 120)[0]!.label).toBe(null);
});

test("the newest era is named even when an older face sits where its name goes: the older face makes way", () => {
  const crowded = placeFaces(eras(100, 860, 880, 960), 1000);
  expect(crowded[3]!.label).toBe("left");
  expect(overlap(crowded)).toBe(false);
});

test("a face at the very start stays apart from the others", () => {
  expect(overlap(placeFaces(eras(0, 20, 40), 576))).toBe(false);
});

test("a name too long to reserve room for never piles faces up", () => {
  const long = placeFaces(
    [50, 150, 250, 350, 570].map((x, i) => ({
      x,
      labelWidth: i === 4 ? 500 : 100,
    })),
    576,
  );
  expect(overlap(long)).toBe(false);
  for (const f of long) expect(f.left).toBeGreaterThanOrEqual(0);
});

test("many eras close together: still apart, even past the right edge", () => {
  const many = placeFaces(
    Array.from({ length: 40 }, (_, i) => ({ x: i * 10, labelWidth: 100 })),
    576,
  );
  expect(overlap(many)).toBe(false);
});
