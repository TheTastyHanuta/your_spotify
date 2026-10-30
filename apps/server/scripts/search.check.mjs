// Run: node scripts/search.check.mjs (Node 24 strips the TS types)
import assert from "node:assert/strict";

import { bestNameMatches } from "../src/tools/search.ts";

const names = (items) => items.map((item) => item.name);
const of = (...list) => list.map((name) => ({ name }));

// Exact, then start, then word start, then anywhere; case does not matter
assert.deepEqual(
  names(
    bestNameMatches(
      of("Amused", "The Muse Song", "Museum", "muse", "Muses"),
      "Muse",
    ),
  ),
  ["muse", "Muses", "Museum", "The Muse Song", "Amused"],
);

// The limit keeps the best matches, not the first ones stored
assert.deepEqual(
  names(bestNameMatches(of("Amused", "Bemused", "Muse"), "muse", 1)),
  ["Muse"],
);

// Equal matches keep their order
assert.deepEqual(names(bestNameMatches(of("Love A", "Love B"), "love")), [
  "Love A",
  "Love B",
]);

// The default limit applies
assert.equal(
  bestNameMatches(
    Array.from({ length: 50 }, (_, i) => ({ name: `the ${i}` })),
    "the",
  ).length,
  20,
);

// Exact matches are never cut, the others still are
const homes = bestNameMatches(
  [
    ...of("Homesick", "At Home"),
    ...Array.from({ length: 25 }, () => ({ name: "Home" })),
  ],
  "home",
);
assert.equal(homes.length, 25);
assert.ok(homes.every((item) => item.name === "Home"));

// Items come back whole
const item = { name: "Muse", id: "x" };
assert.equal(bestNameMatches([item], "muse")[0], item);

console.log("search ok");
