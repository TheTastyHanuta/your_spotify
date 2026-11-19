import { expect, test } from "vitest";

import { selectRange } from "./selectRange";

test("nothing selected selects the clicked row", () => {
  expect(selectRange([], 3)).toStrictEqual([3]);
});

test("adds the rows down to the clicked one", () => {
  expect(selectRange([1], 3)).toStrictEqual([1, 2, 3]);
});

test("adds the rows up to the clicked one", () => {
  expect(selectRange([5, 3], 1)).toStrictEqual([5, 3, 2, 1]);
});

test("clicking the last selected row keeps the selection", () => {
  expect(selectRange([2, 4], 4)).toStrictEqual([2, 4]);
});
