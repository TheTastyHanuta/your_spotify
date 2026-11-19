import { expect, test } from "vitest";

import { artistBlacklistMark } from "./blacklist";

test("a listen of a blacklisted artist is marked", () => {
  expect(artistBlacklistMark(["a", "b"], "b")).toStrictEqual({
    blacklistedBy: ["artist"],
  });
});

test("a listen of any other artist is not", () => {
  expect(artistBlacklistMark(["a"], "b")).toStrictEqual({});
});
