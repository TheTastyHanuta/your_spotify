import { expect, test } from "vitest";

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
  expect(top[0]!.sessionLength).toBe(60 * minute);
  expect(top[0]!.plays).toHaveLength(1);
  expect(top).toHaveLength(5);
});

test("a pause up to the gap keeps the session going, a longer one splits it", () => {
  expect(
    longestSessions([play(0, 3), play(13, 3)], 10 * minute, 5),
  ).toHaveLength(1);
  expect(
    longestSessions([play(0, 3), play(14, 3)], 10 * minute, 5),
  ).toHaveLength(2);
});

test("no plays, no sessions", () => {
  expect(longestSessions([], 10 * minute, 5)).toStrictEqual([]);
});
