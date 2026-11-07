import { expect, test } from "vitest";

import { DROPPED_FROM, droppedOut, withMoves } from "./movers";

const item = (id: string) => ({ id });
const items = (...ids: string[]) => ids.map(item);
const id = (it: { id: string }) => it.id;

test("each item gets its rank and its rank of the previous year, new ones none", () => {
  expect(withMoves(items("b", "new", "a"), ["a", "b"], id)).toStrictEqual([
    { item: item("b"), rank: 1, before: 2 },
    { item: item("new"), rank: 2, before: undefined },
    { item: item("a"), rank: 3, before: 1 },
  ]);
});

test("dropped out: the previous top items missing now, with their previous rank", () => {
  expect(droppedOut(items("a", "b", "c"), ["c", "a"], id)).toStrictEqual([
    { item: item("b"), before: 2 },
  ]);
});

test("only the previous top DROPPED_FROM count as dropped out", () => {
  const previous = items(
    ...Array.from({ length: DROPPED_FROM + 5 }, (_, i) => `${i}`),
  );
  expect(droppedOut(previous, [], id)).toStrictEqual(
    previous
      .slice(0, DROPPED_FROM)
      .map((it, i) => ({ item: it, before: i + 1 })),
  );
});
