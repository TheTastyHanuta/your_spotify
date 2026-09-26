import { Request, Response, Router } from "express";
import { decode, sign } from "jsonwebtoken";
import { z } from "zod";

import {
  createUser,
  getUserCount,
  getUserFromField,
  storeInUser,
} from "../database";
import { getPrivateData } from "../database/queries/privateData";
import { RateLimitedError } from "../tools/apis/queueHttpClient";
import { SpotifyMe } from "../tools/apis/spotifyApi";
import { get, getWithDefault } from "../tools/env";
import { logger } from "../tools/logger";
import {
  logged,
  validate,
  withGlobalPreferences,
  withHttpClient,
} from "../tools/middleware";
import { spotifyProvider } from "../tools/oauth/Provider";
import { GlobalPreferencesRequest, SpotifyRequest } from "../tools/types";

export const router = Router();

// Without an expiry date the browser drops the cookie when it closes, which
// sent everyone back through Spotify, and during a Spotify ban locked them out
// of stats that only need the database. It now lives as long as the token.
function storeTokenInCookie(
  request: Request,
  response: Response,
  token: string,
) {
  const { exp } = (decode(token) ?? {}) as { exp?: number };
  response.cookie("token", token, {
    sameSite: "strict",
    httpOnly: true,
    secure: request.secure,
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  });
}

const cookieValidity = () =>
  getWithDefault("COOKIE_VALIDITY_MS", "30d") as `${number}`;

const OAUTH_COOKIE_NAME = "oauth";
const spotifyCallbackOAuthCookie = z.object({ state: z.string() });
type OAuthCookie = z.infer<typeof spotifyCallbackOAuthCookie>;

router.get("/spotify", async (req, res) => {
  const isOffline = get("OFFLINE_DEV_ID");
  if (isOffline) {
    const privateData = await getPrivateData();
    if (!privateData?.jwtPrivateKey) {
      throw new Error("No private data found, cannot sign JWT");
    }
    const token = sign({ userId: isOffline }, privateData.jwtPrivateKey, {
      expiresIn: cookieValidity(),
    });
    storeTokenInCookie(req, res, token);
    res.status(204).end();
    return;
  }
  const { url, state } = await spotifyProvider.getRedirect();
  const oauthCookie: OAuthCookie = { state };

  res.cookie(OAUTH_COOKIE_NAME, oauthCookie, {
    sameSite: "lax",
    httpOnly: true,
    secure: req.secure,
  });

  res.redirect(url);
});

const spotifyCallback = z.object({ code: z.string(), state: z.string() });

router.get("/spotify/callback", withGlobalPreferences, async (req, res) => {
  const { query, globalPreferences } = req as GlobalPreferencesRequest;
  const { code, state } = validate(query, spotifyCallback);
  // A failed login lands on the login page with the reason, which also keeps
  // "Remember me" from sending the browser straight back to Spotify in a loop.
  let redirectTo = get("CLIENT_ENDPOINT");

  try {
    const cookie = spotifyCallbackOAuthCookie.parse(
      req.cookies[OAUTH_COOKIE_NAME],
    );

    if (state !== cookie.state) {
      throw new Error("State does not match");
    }

    const infos = await spotifyProvider.exchangeCode(code, cookie.state);

    const client = spotifyProvider.getHttpClient(infos.accessToken);
    const { data: spotifyMe } = await client.get<SpotifyMe>("/me", {
      priority: "high",
    });
    let user = await getUserFromField("spotifyId", spotifyMe.id, false);
    if (!user) {
      if (!globalPreferences.allowRegistrations) {
        return res.redirect(`${get("CLIENT_ENDPOINT")}/registrations-disabled`);
      }
      const nbUsers = await getUserCount();
      user = await createUser(
        spotifyMe.display_name,
        spotifyMe.id,
        nbUsers === 0,
      );
    }
    await storeInUser("_id", user._id, {
      ...infos,
      spotifyAuthDate: new Date(),
      spotifyReauthRequired: false,
    });
    const privateData = await getPrivateData();
    if (!privateData?.jwtPrivateKey) {
      throw new Error("No private data found, cannot sign JWT");
    }
    const token = sign(
      { userId: user._id.toString() },
      privateData.jwtPrivateKey,
      { expiresIn: cookieValidity() },
    );
    storeTokenInCookie(req, res, token);
  } catch (e) {
    logger.error(e);
    const params = new URLSearchParams(
      e instanceof RateLimitedError
        ? { error: "spotify_rate_limited", until: e.until.toISOString() }
        : { error: "login_failed" },
    );
    redirectTo = `${get("CLIENT_ENDPOINT")}/login?${params.toString()}`;
  } finally {
    res.clearCookie(OAUTH_COOKIE_NAME);
  }
  return res.redirect(redirectTo);
});

router.get("/spotify/me", logged, withHttpClient, async (req, res) => {
  const { client } = req as SpotifyRequest;

  console.log("WYTFUDGZJDGHZAKJHDKJZHZDKJHAZJKDHZAJKDHJKAHZ");

  try {
    const me = await client.me();
    res.status(200).send(me);
  } catch (e) {
    logger.error(e);
    res.status(500).send({ code: "SPOTIFY_ERROR" });
  }
});
