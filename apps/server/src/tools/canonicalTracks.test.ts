import assert from "node:assert/strict";

import { test } from "vitest";

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
  assert.deepEqual(run([played("a", "X")], []), {
    canonical: { a: "a" },
    missing: ["a"],
    versions: {},
  });
});

test("played again: the stored track, nothing new", () => {
  assert.deepEqual(run([played("a", "X")], [{ id: "a", isrc: "X" }]), {
    canonical: { a: "a" },
    missing: [],
    versions: {},
  });
});

test("another version of a stored recording: merged into it and kept as version", () => {
  assert.deepEqual(run([played("album", "X")], [{ id: "single", isrc: "X" }]), {
    canonical: { album: "single" },
    missing: [],
    versions: { album: "single" },
  });
});

test("a version already stored as a duplicate is not added again", () => {
  assert.deepEqual(
    run(
      [played("album", "X")],
      [
        { id: "single", isrc: "X" },
        { id: "album", mergedInto: "single" },
      ],
    ),
    { canonical: { album: "single" }, missing: [], versions: {} },
  );
});

// It is never turned into a duplicate here
test("a stored track without ISRC that now matches another one keeps its own entry", () => {
  assert.deepEqual(
    run([played("old", "X")], [{ id: "single", isrc: "X" }, { id: "old" }]),
    { canonical: { old: "single" }, missing: [], versions: {} },
  );
});

test("two new versions in one batch: the first is stored, the second merged into it", () => {
  assert.deepEqual(run([played("a", "X"), played("b", "X")], []), {
    canonical: { a: "a", b: "a" },
    missing: ["a"],
    versions: { b: "a" },
  });
});

test("the same new track twice in one batch is no version of itself", () => {
  assert.deepEqual(run([played("a", "X"), played("a", "X")], []), {
    canonical: { a: "a" },
    missing: ["a"],
    versions: {},
  });
});

test("without an ISRC nothing can be merged", () => {
  assert.deepEqual(run([played("b")], [{ id: "a", isrc: "X" }]), {
    canonical: { b: "b" },
    missing: ["b"],
    versions: {},
  });
});

test("local files have no id", () => {
  assert.deepEqual(
    run([{ id: null, external_ids: {} } as unknown as Args[0][number]], []),
    { canonical: {}, missing: [], versions: {} },
  );
});

// An import reuses the stored version, which has no ISRC
test("a version of a primary that was merged again later reaches the new primary", () => {
  assert.deepEqual(
    run(
      [played("v")],
      [
        { id: "v", mergedInto: "p" },
        { id: "p", mergedInto: "q" },
        { id: "q", isrc: "X" },
      ],
    ),
    { canonical: { v: "q" }, missing: [], versions: {} },
  );
});

test("a chain whose end is not stored stops at the last stored track", () => {
  assert.deepEqual(
    run(
      [played("v")],
      [
        { id: "v", mergedInto: "p" },
        { id: "p", mergedInto: "gone" },
      ],
    ),
    { canonical: { v: "p" }, missing: [], versions: {} },
  );
});

test("a loop of merged tracks ends instead of running forever", () => {
  assert.notEqual(
    run(
      [played("a")],
      [
        { id: "a", mergedInto: "b" },
        { id: "b", mergedInto: "a" },
      ],
    ).canonical.a,
    undefined,
  );
});
