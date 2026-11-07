import assert from "node:assert/strict";

import { test } from "vitest";

import { bestNameMatches } from "./search";

const names = (items: { name: string }[]) => items.map((item) => item.name);
const of = (...list: string[]) => list.map((name) => ({ name }));

test("exact, then start, then word start, then anywhere; case does not matter", () => {
  assert.deepEqual(
    names(
      bestNameMatches(
        of("Amused", "The Muse Song", "Museum", "muse", "Muses"),
        "Muse",
      ),
    ),
    ["muse", "Muses", "Museum", "The Muse Song", "Amused"],
  );
});

test("the limit keeps the best matches, not the first ones stored", () => {
  assert.deepEqual(
    names(bestNameMatches(of("Amused", "Bemused", "Muse"), "muse", 1)),
    ["Muse"],
  );
});

test("equal matches keep their order", () => {
  assert.deepEqual(names(bestNameMatches(of("Love A", "Love B"), "love")), [
    "Love A",
    "Love B",
  ]);
});

test("the default limit applies", () => {
  assert.equal(
    bestNameMatches(
      Array.from({ length: 50 }, (_, i) => ({ name: `the ${i}` })),
      "the",
    ).length,
    20,
  );
});

test("exact matches are never cut, the others still are", () => {
  const homes = bestNameMatches(
    [
      ...of("Homesick", "At Home"),
      ...Array.from({ length: 25 }, () => ({ name: "Home" })),
    ],
    "home",
  );
  assert.equal(homes.length, 25);
  assert.ok(homes.every((item) => item.name === "Home"));
});

test("items come back whole", () => {
  const item = { name: "Muse", id: "x" };
  assert.equal(bestNameMatches([item], "muse")[0], item);
});
