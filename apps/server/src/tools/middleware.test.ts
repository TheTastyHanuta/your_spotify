import { expect, test } from "vitest";

import { needsRenewal } from "./middleware";

// A 30-day session issued at 0, in seconds
const DAY = 24 * 60 * 60;
const session = { iat: 1_000_000, exp: 1_000_000 + 30 * DAY };
const at = (days: number) => (session.iat + days * DAY) * 1000;

test("a session is renewed only once half its lifetime has passed", () => {
  expect(needsRenewal(session, at(1))).toBe(false);
  expect(needsRenewal(session, at(15))).toBe(false);
  expect(needsRenewal(session, at(15.01))).toBe(true);
  expect(needsRenewal(session, at(29))).toBe(true);
});

test("a token without issue or expiry time is never renewed", () => {
  expect(needsRenewal({ exp: session.exp }, at(29))).toBe(false);
  expect(needsRenewal({ iat: session.iat }, at(29))).toBe(false);
  expect(needsRenewal({}, at(29))).toBe(false);
});
