import assert from "node:assert/strict";

import { test } from "vitest";

import { longestSessions } from "./sessions";

const minute = 60 * 1000;
const play = (startMin: number, lengthMin: number) => ({
  played_at: new Date(startMin * minute),
  durationMs: lengthMin * minute,
});

test("a single 60-minute song beats five short sessions: the last song counts", () => {
  const plays = [
    play(0, 60),
    ...[100, 200, 300, 400, 500].flatMap((at) => [
      play(at, 2),
      play(at + 2, 2),
    ]),
  ];
  const top = longestSessions(plays, 10 * minute, 5);
  assert.equal(top[0]!.sessionLength, 60 * minute);
  assert.equal(top[0]!.plays.length, 1);
  assert.equal(top.length, 5);
});

test("a pause up to the gap keeps the session going, a longer one splits it", () => {
  assert.equal(
    longestSessions([play(0, 3), play(13, 3)], 10 * minute, 5).length,
    1,
  );
  assert.equal(
    longestSessions([play(0, 3), play(14, 3)], 10 * minute, 5).length,
    2,
  );
});

test("no plays, no sessions", () => {
  assert.deepEqual(longestSessions([], 10 * minute, 5), []);
});
