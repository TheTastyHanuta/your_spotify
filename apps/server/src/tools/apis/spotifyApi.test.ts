import { expect, test } from "vitest";

import { nextSlowdownMs, slowdownMsOf } from "./spotifyApi";

// With the default SPOTIFY_API_DELAY_MS of 2000
test("a job starts at 1.5 times the queue delay, or at the slowdown it was saved with", () => {
  expect(slowdownMsOf({})).toBe(3000);
  expect(slowdownMsOf({ slowdownMs: 7000 })).toBe(7000);
});

test("every ban slows a job down by half again, up to 16 times the queue delay", () => {
  expect(nextSlowdownMs({})).toBe(4500);
  expect(nextSlowdownMs({ slowdownMs: 4500 })).toBe(6750);
  expect(nextSlowdownMs({ slowdownMs: 30_000 })).toBe(32_000);
  expect(nextSlowdownMs({ slowdownMs: 32_000 })).toBe(32_000);
});
