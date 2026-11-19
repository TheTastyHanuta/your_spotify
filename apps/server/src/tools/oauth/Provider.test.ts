import { expect, test } from "vitest";

import { tokensFrom } from "./Provider";

const NOW = new Date("2026-11-01T12:00:00Z").getTime();

test("a new refresh token from Spotify is kept", () => {
  expect(
    tokensFrom(
      { access_token: "a", refresh_token: "r", expires_in: 3600 },
      NOW,
    ),
  ).toStrictEqual({
    accessToken: "a",
    refreshToken: "r",
    expiresIn: NOW + 3600 * 1000,
  });
});

test("without a new refresh token the stored one is left alone", () => {
  expect(
    tokensFrom({ access_token: "a", expires_in: 3600 }, NOW),
  ).toStrictEqual({ accessToken: "a", expiresIn: NOW + 3600 * 1000 });
});
