import { expect, test } from "vitest";

import { bestNameMatches } from "./search";

const names = (items: { name: string }[]) => items.map((item) => item.name);
const of = (...list: string[]) => list.map((name) => ({ name }));

test("exact, then start, then word start, then anywhere; case does not matter", () => {
  expect(
    names(
      bestNameMatches(
        of("Amused", "The Muse Song", "Museum", "muse", "Muses"),
        "Muse",
      ),
    ),
  ).toStrictEqual(["muse", "Muses", "Museum", "The Muse Song", "Amused"]);
});

test("the limit keeps the best matches, not the first ones stored", () => {
  expect(
    names(bestNameMatches(of("Amused", "Bemused", "Muse"), "muse", 1)),
  ).toStrictEqual(["Muse"]);
});

test("equal matches keep their order", () => {
  expect(names(bestNameMatches(of("Love A", "Love B"), "love"))).toStrictEqual([
    "Love A",
    "Love B",
  ]);
});

test("the default limit applies", () => {
  expect(
    bestNameMatches(
      Array.from({ length: 50 }, (_, i) => ({ name: `the ${i}` })),
      "the",
    ),
  ).toHaveLength(20);
});

test("exact matches are never cut, the others still are", () => {
  const homes = bestNameMatches(
    [
      ...of("Homesick", "At Home"),
      ...Array.from({ length: 25 }, () => ({ name: "Home" })),
    ],
    "home",
  );
  expect(names(homes)).toStrictEqual(Array(25).fill("Home"));
});

test("items come back whole", () => {
  const item = { name: "Muse", id: "x" };
  expect(bestNameMatches([item], "muse")[0]).toBe(item);
});
