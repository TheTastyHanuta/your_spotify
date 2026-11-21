import { describe, expect, it } from "vitest";

import { isrcOf, normalizeIsrc, planIsrcNormalization } from "./isrc";

describe("normalizeIsrc", () => {
  it("uppercases and drops separators", () => {
    expect(normalizeIsrc("se5vf1800736")).toBe("SE5VF1800736");
    expect(normalizeIsrc("GB-SMU-23-12951")).toBe("GBSMU2312951");
    expect(normalizeIsrc(" QzK6q 2177387 ")).toBe("QZK6Q2177387");
  });

  it("gives undefined for missing or empty values", () => {
    expect(normalizeIsrc(undefined)).toBeUndefined();
    expect(normalizeIsrc(null)).toBeUndefined();
    expect(normalizeIsrc("")).toBeUndefined();
    expect(normalizeIsrc("--")).toBeUndefined();
  });
});

describe("isrcOf", () => {
  it("reads the normalized ISRC of a Spotify track", () => {
    expect(isrcOf({ external_ids: { isrc: "us-abc-12-34567" } })).toBe(
      "USABC1234567",
    );
    expect(isrcOf({ external_ids: {} })).toBeUndefined();
    expect(isrcOf(undefined)).toBeUndefined();
  });
});

describe("planIsrcNormalization", () => {
  it("rewrites odd spellings that collide with nothing", () => {
    expect(
      planIsrcNormalization([
        { id: "a", isrc: "GB-SMU-23-12951" },
        { id: "b", isrc: "USABC1234567" },
      ]),
    ).toStrictEqual({
      rewrite: [{ id: "a", isrc: "GBSMU2312951" }],
      toLookUp: [],
    });
  });

  it("keeps the standard spelling and hands its twins to the merge", () => {
    expect(
      planIsrcNormalization([
        { id: "lower", isrc: "se5vf1800736" },
        { id: "standard", isrc: "SE5VF1800736" },
        { id: "hyphens", isrc: "SE-5VF-18-00736" },
      ]),
    ).toStrictEqual({
      rewrite: [],
      toLookUp: [
        { id: "lower", isrc: "SE5VF1800736" },
        { id: "hyphens", isrc: "SE5VF1800736" },
      ],
    });
  });

  it("leaves values without letters or digits alone", () => {
    expect(planIsrcNormalization([{ id: "a", isrc: "--" }])).toStrictEqual({
      rewrite: [],
      toLookUp: [],
    });
  });

  it("keeps the first track when no spelling is standard", () => {
    expect(
      planIsrcNormalization([
        { id: "a", isrc: "QzK6q2177387" },
        { id: "b", isrc: "qzk6q2177387" },
      ]),
    ).toStrictEqual({
      rewrite: [{ id: "a", isrc: "QZK6Q2177387" }],
      toLookUp: [{ id: "b", isrc: "QZK6Q2177387" }],
    });
  });
});
