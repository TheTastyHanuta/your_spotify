import { describe, expect, it } from "vitest";

import { listedUnmatched, unmatchedText } from "./full_privacy";

const listen = (time: string, trackId: string) => ({
  _id: trackId,
  time: Date.parse(time),
  trackId,
});

describe("unmatchedText", () => {
  it("lists each listen with its UTC time and song, the id when the name is unknown", () => {
    expect(
      unmatchedText(
        [
          listen("2025-07-29T22:17:55.001Z", "a"),
          listen("2026-11-19T18:09:21.879Z", "b"),
        ],
        2,
        new Map([["a", "Sweater Weather – The Neighbourhood"]]),
      ).split("\n"),
    ).toStrictEqual([
      expect.stringMatching(/^Import: stored listens the export doesn't have/),
      "  2025-07-29 22:17:55  Sweater Weather – The Neighbourhood",
      "  2026-11-19 18:09:21  b",
    ]);
  });

  it("says how many more there are than it lists", () => {
    const lines = unmatchedText(
      [listen("2025-07-29T22:17:55Z", "a")],
      90120,
      new Map(),
    ).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("  … and 90119 more.");
  });
});

describe("listedUnmatched", () => {
  it("keeps the 100 oldest listens, oldest first", () => {
    const start = Date.parse("2025-01-01T00:00:00Z");
    const listens = Array.from({ length: 150 }, (_, i) => ({
      _id: String(i),
      time: start + ((i * 37) % 150) * 60_000,
      trackId: String(i),
    }));
    const times = listedUnmatched(listens).map(
      (l) => (l.time - start) / 60_000,
    );
    expect(times).toStrictEqual(Array.from({ length: 100 }, (_, i) => i));
  });
});
