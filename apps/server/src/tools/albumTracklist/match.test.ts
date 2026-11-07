import { expect, test } from "vitest";

import type { AlbumTracklistEntry } from "../../database/schemas/albumTracklist";
import { primaryIdOf } from "../canonicalTracks";
import { isrcCandidates, normalizeName, resolveEntries } from "./match";

const entry = (
  id: string,
  name: string,
  extra: Partial<AlbumTracklistEntry> = {},
): AlbumTracklistEntry => ({
  id,
  name,
  disc: 1,
  no: 1,
  ms: 200000,
  artist: "A",
  ...extra,
});
const stored = (name: string, artists = ["A"]) => ({ name, artists });

test("names compare without case, version tails and brackets", () => {
  expect(normalizeName("Faded - Radio Edit")).toBe("faded");
  expect(normalizeName("Different World (feat. CORSAK)")).toBe(
    "different world",
  );
  expect(normalizeName("  Lose  Yourself ")).toBe("lose yourself");
});

test("looked up: entries not stored, not looked up yet, with a stored primary of a similar name by the same first artist", () => {
  expect(
    isrcCandidates(
      [
        entry("single", "Darkside (feat. Au/Ra)"),
        entry("remix", "Ignite"),
        entry("storedId", "Darkside"),
        entry("done", "Darkside", { isrc: "X" }),
        entry("none", "Darkside", { isrc: null }),
        entry("otherArtist", "Alone"),
        entry("never", "Never heard"),
      ],
      new Set(["storedId"]),
      [
        stored("Darkside"),
        // Another recording still costs a lookup: the ISRC tells them apart
        stored("Ignite (feat. K-391) - Instrumental"),
        stored("Alone", ["B", "A"]),
      ],
    ).map((e) => e.id),
  ).toStrictEqual(["single", "remix"]);
});

test("a stored entry resolves by its own id, through merges to the current primary; any other by the stored primary with its ISRC; the rest (another ISRC, none, not looked up) adds nothing", () => {
  const storedById = new Map([
    ["played", { id: "played" }],
    ["version", { id: "version", mergedInto: "old" }],
    ["old", { id: "old", mergedInto: "primary" }],
    ["primary", { id: "primary" }],
  ]);
  expect(
    [
      ...resolveEntries(
        [
          entry("played", "Played"),
          entry("version", "Version"),
          entry("albumOnly", "From the single", { isrc: "S" }),
          entry("otherRecording", "Ignite", { isrc: "OTHER" }),
          entry("noIsrc", "No ISRC", { isrc: null }),
          entry("never", "Never heard"),
        ],
        new Set(storedById.keys()),
        (id) => primaryIdOf(storedById.get(id)!, storedById),
        new Map([["S", "single"]]),
      ),
    ].sort(),
  ).toStrictEqual(["played", "primary", "single"]);
});
