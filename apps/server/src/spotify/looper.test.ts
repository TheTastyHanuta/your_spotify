import { describe, expect, test } from "vitest";

import { latePlaysNote } from "./looper";

describe("latePlaysNote", () => {
  const now = Date.parse("2026-11-19T01:00:00.000Z");
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

  test("says nothing when every play is recent", () => {
    expect(latePlaysNote([minutesAgo(3), minutesAgo(30)], now)).toBe("");
  });

  test("counts late plays and names the oldest", () => {
    expect(
      latePlaysNote([minutesAgo(3), minutesAgo(45), minutesAgo(190)], now),
    ).toBe(
      "; 2 played over 30 minutes ago, the oldest at 2026-11-18T21:50:00.000Z",
    );
  });
});
