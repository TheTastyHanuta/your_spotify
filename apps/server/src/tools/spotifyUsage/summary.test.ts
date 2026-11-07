import { describe, expect, test } from "vitest";

import {
  budgetUsage,
  endpointOf,
  HOUR_MS,
  requestsBefore,
  summarize,
  WATCH_ERRORS,
  type SpotifyBlock,
  type UsageHour,
} from "./summary";

// Thursday 2026-10-29, 14:30 UTC
const now = new Date(Date.UTC(2026, 9, 29, 14, 30));
const current = Date.UTC(2026, 9, 29, 14);
// The hour starting n hours before the current one
const ago = (
  n: number,
  outcomes: UsageHour["outcomes"],
  sources: UsageHour["sources"] = { polling: 1 },
): UsageHour => ({ hour: new Date(current - n * HOUR_MS), outcomes, sources });
const run = (
  hours: UsageHour[],
  block: SpotifyBlock | null = null,
  tz = "UTC",
) => summarize(hours, now, tz, block);

describe("summarize", () => {
  test("nothing counted yet: all fine, no deltas, full-length series", () => {
    const s = run([]);
    expect(s.verdict).toBe("fine");
    expect(s.counted).toBe(false);
    expect(s.lastHour).toStrictEqual({ value: 0, usual: null });
    expect(s.hourly).toHaveLength(48);
    expect(s.daily).toHaveLength(30);
    expect(s.weekly).toHaveLength(12);
    expect(s.daily.at(-1)!.day).toBe("2026-10-29");
    expect(s.weekly.at(-1)!.to).toBe("2026-10-29");
    expect(s.weekly.at(-1)!.from).toBe("2026-10-23");
    expect(s.weekly.at(-2)!.to).toBe("2026-10-22");
    expect(s.hourly.at(-1)!.hour).toBe(current);
  });

  test('an active ban is "blocked", an ended one only counts as a ban this week', () => {
    const later: SpotifyBlock = {
      until: new Date(now.getTime() + HOUR_MS),
      kind: "quota",
    };
    expect(run([], later).verdict).toBe("blocked");
    expect(run([], later).block).toBe(later);
    const over: SpotifyBlock = {
      until: new Date(now.getTime() - HOUR_MS),
      kind: "ban",
    };
    expect(run([], over).verdict).toBe("fine");
    expect(run([], over).block).toBe(null);
  });

  test("watch: a retried 429 in the current hour, enough errors, a ban this week", () => {
    expect(run([ago(0, { retried429: 1 })]).verdict).toBe("watch");
    // The bucket of 24 hours ago still counts: its 429 may be 23 hours old
    expect(run([ago(24, { retried429: 1 })]).verdict).toBe("watch");
    expect(run([ago(25, { retried429: 1 })]).verdict).toBe("fine");
    expect(run([ago(3, { error: WATCH_ERRORS - 1 })]).verdict).toBe("fine");
    expect(run([ago(3, { error: WATCH_ERRORS })]).verdict).toBe("watch");
    expect(run([ago(6 * 24, { ban: 1 })]).verdict).toBe("watch");
    expect(run([ago(7 * 24, { ban: 1 })]).verdict).toBe("watch");
    expect(run([ago(8 * 24, { quota: 1 })]).verdict).toBe("fine");
  });

  test("rate limits of the last 7 days including the current hour, and the hour of the last one", () => {
    const s = run([
      ago(0, { retried429: 1 }),
      ago(2, { ok: 5, retried429: 2 }),
      ago(30, { quota: 1 }),
      ago(10 * 24, { ban: 1 }),
    ]);
    expect(s.limited7d).toBe(4);
    expect(s.lastLimitedAt).toBe(current);
    expect(s.hourly.at(-3)!.limited).toBe(2);
    expect(s.hourly.at(-3)!.total).toBe(7);
  });

  // The 7-day usual only averages the one full week counted before it
  test("steady 10 an hour for three weeks: usual equals the value", () => {
    const hours = Array.from({ length: 21 * 24 }, (_, i) =>
      ago(i, { ok: 9, clientError: 1 }),
    );
    const s = run(hours);
    expect(s.lastHour).toStrictEqual({ value: 10, usual: 10 });
    expect(s.last24h).toStrictEqual({ value: 240, usual: 240 });
    expect(s.last7d).toStrictEqual({ value: 1680, usual: 1680 });
    expect(s.sources7d.polling).toBe(169);
    expect(s.verdict).toBe("fine");
  });

  test("counting started 30 hours ago: one previous day is not full, so no usual", () => {
    const hours = Array.from({ length: 30 }, (_, i) => ago(i, { ok: 1 }));
    const s = run(hours);
    expect(s.last24h.usual).toBe(null);
    expect(s.lastHour.usual).toBe(1);
  });

  test("sources are summed per name, the current hour included; the stat cells count full hours only", () => {
    const s = run([
      ago(0, { ok: 4 }, { import: 4 }),
      ago(1, { ok: 3 }, { import: 2, auth: 1 }),
    ]);
    expect(s.sources7d).toStrictEqual({ import: 6, auth: 1 });
    expect(s.last7d.value).toBe(3);
  });

  test("days follow the time zone: 23:00 UTC is already the next day in Berlin", () => {
    const late: UsageHour = {
      hour: new Date(Date.UTC(2026, 9, 28, 23)),
      outcomes: { ok: 5 },
    };
    expect(run([late]).daily.at(-2)!.total).toBe(5);
    expect(run([late], null, "Europe/Berlin").daily.at(-1)!.total).toBe(5);
  });
});

test("the budget counts the last 24 hours and the current one, and frees up as the oldest hours leave that window", () => {
  const hours = [
    ago(25, { ok: 1000 }),
    ago(24, { ok: 300 }, { polling: 100, isrc: 200 }),
    ago(10, { ok: 200, ban: 1 }),
    ago(0, { ok: 100 }, { import: 60, polling: 40 }),
  ];
  const fine = budgetUsage(hours, now, 1000);
  expect(fine.used).toBe(601);
  expect(fine.background).toBe(260);
  expect(fine.until).toBe(null);
  // Used up: waits until 250 are free again, which takes the hour 24 ago
  // (300) leaving the window when the hour after the current one starts
  const over = budgetUsage(hours, now, 601);
  expect(over.until!.getTime()).toBe(current + HOUR_MS);
  // With 290 left after it that is not enough room, the hour 10 ago has to
  // go as well
  expect(budgetUsage(hours, now, 540).until!.getTime()).toBe(
    current + 15 * HOUR_MS,
  );
  // A budget under the room waits until nothing is counted
  expect(budgetUsage(hours, now, 100).until!.getTime()).toBe(
    current + 25 * HOUR_MS,
  );
  // Nothing counted, nothing to wait for
  expect(budgetUsage([], now, 0).until).toStrictEqual(null);
});

test("endpoints lose IDs and query, other hosts keep theirs", () => {
  expect(
    endpointOf(
      "https://api.spotify.com/v1/tracks/4uLU6hMCjMI75M1A2tKUQC?market=DE",
    ),
  ).toBe("/tracks/{id}");
  expect(
    endpointOf("https://api.spotify.com/v1/me/player/recently-played"),
  ).toBe("/me/player/recently-played");
  expect(
    endpointOf("https://api.spotify.com/v1/users/some.user/playlists"),
  ).toBe("/users/{id}/playlists");
  expect(
    endpointOf(
      "https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks",
    ),
  ).toBe("/playlists/{id}/tracks");
  expect(endpointOf("https://accounts.spotify.com/api/token")).toBe(
    "accounts.spotify.com/api/token",
  );
});

test("requests before a limit: the 24 hours before and the current hour by source, and those since the previous ban ended", () => {
  const hours = [
    ago(0, { ok: 3 }, { isrc: 2, polling: 1 }),
    ago(5, { ok: 10 }, { isrc: 10 }),
    ago(24, { ok: 1 }, { polling: 1 }),
    ago(25, { ok: 100 }, { isrc: 100 }),
    ago(-1, { ok: 7 }, { polling: 7 }),
  ];
  const r = requestsBefore(
    hours,
    now,
    new Date(current - 5 * HOUR_MS + 600_000),
  );
  expect(r.requests24h).toStrictEqual({ isrc: 12, polling: 2 });
  expect(r.sinceBan).toBe(13);
  expect(requestsBefore(hours, now, null).sinceBan).toBe(null);
  expect(requestsBefore([], now, null).requests24h.isrc).toBe(undefined);
});
