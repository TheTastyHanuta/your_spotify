import { expect, test } from "vitest";

import { canonicalizeSpotifyTracks } from "./canonicalTracks";

type Args = Parameters<typeof canonicalizeSpotifyTracks>;

const played = (id: string, isrc?: string) =>
  ({ id, external_ids: isrc ? { isrc } : {} }) as Args[0][number];
const run = (spotifyTracks: Args[0], storedTracks: Args[1]) => {
  const r = canonicalizeSpotifyTracks(spotifyTracks, storedTracks);
  return {
    canonical: Object.fromEntries(r.canonicalIdBySpotifyId),
    missing: r.missingTrackIds,
    versions: Object.fromEntries(r.mergedVersionIds),
  };
};

test("a new recording is stored as it is, no version", () => {
  expect(run([played("a", "X")], [])).toStrictEqual({
    canonical: { a: "a" },
    missing: ["a"],
    versions: {},
  });
});

test("played again: the stored track, nothing new", () => {
  expect(run([played("a", "X")], [{ id: "a", isrc: "X" }])).toStrictEqual({
    canonical: { a: "a" },
    missing: [],
    versions: {},
  });
});

test("another version of a stored recording: merged into it and kept as version", () => {
  expect(
    run([played("album", "X")], [{ id: "single", isrc: "X" }]),
  ).toStrictEqual({
    canonical: { album: "single" },
    missing: [],
    versions: { album: "single" },
  });
});

test("a version already stored as a duplicate is not added again", () => {
  expect(
    run(
      [played("album", "X")],
      [
        { id: "single", isrc: "X" },
        { id: "album", mergedInto: "single" },
      ],
    ),
  ).toStrictEqual({
    canonical: { album: "single" },
    missing: [],
    versions: {},
  });
});

// It is never turned into a duplicate here
test("a stored track without ISRC that now matches another one keeps its own entry", () => {
  expect(
    run([played("old", "X")], [{ id: "single", isrc: "X" }, { id: "old" }]),
  ).toStrictEqual({ canonical: { old: "single" }, missing: [], versions: {} });
});

test("two new versions in one batch: the first is stored, the second merged into it", () => {
  expect(run([played("a", "X"), played("b", "X")], [])).toStrictEqual({
    canonical: { a: "a", b: "a" },
    missing: ["a"],
    versions: { b: "a" },
  });
});

test("the same new track twice in one batch is no version of itself", () => {
  expect(run([played("a", "X"), played("a", "X")], [])).toStrictEqual({
    canonical: { a: "a" },
    missing: ["a"],
    versions: {},
  });
});

test("without an ISRC nothing can be merged", () => {
  expect(run([played("b")], [{ id: "a", isrc: "X" }])).toStrictEqual({
    canonical: { b: "b" },
    missing: ["b"],
    versions: {},
  });
});

test("local files have no id", () => {
  expect(
    run([{ id: null, external_ids: {} } as unknown as Args[0][number]], []),
  ).toStrictEqual({ canonical: {}, missing: [], versions: {} });
});

// An import reuses the stored version, which has no ISRC
test("a version of a primary that was merged again later reaches the new primary", () => {
  expect(
    run(
      [played("v")],
      [
        { id: "v", mergedInto: "p" },
        { id: "p", mergedInto: "q" },
        { id: "q", isrc: "X" },
      ],
    ),
  ).toStrictEqual({ canonical: { v: "q" }, missing: [], versions: {} });
});

test("a chain whose end is not stored stops at the last stored track", () => {
  expect(
    run(
      [played("v")],
      [
        { id: "v", mergedInto: "p" },
        { id: "p", mergedInto: "gone" },
      ],
    ),
  ).toStrictEqual({ canonical: { v: "p" }, missing: [], versions: {} });
});

test("a loop of merged tracks ends instead of running forever", () => {
  expect(
    run(
      [played("a")],
      [
        { id: "a", mergedInto: "b" },
        { id: "b", mergedInto: "a" },
      ],
    ).canonical.a,
  ).not.toBe(undefined);
});
