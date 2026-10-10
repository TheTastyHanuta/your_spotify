import { hrtime } from "process";

import { NextFunction, Request, Response } from "express";
import { decode, sign, verify } from "jsonwebtoken";
import { Types } from "mongoose";
import { z } from "zod";

import { getUserFromField, getGlobalPreferences } from "../database";
import { getUserImporterState } from "../database/queries/importer";
import { getPrivateData } from "../database/queries/privateData";
import { SpotifyAPI } from "./apis/spotifyApi";
import { get, getWithDefault } from "./env";
import { YourSpotifyError } from "./errors/error";
import { logger } from "./logger";
import { Metrics } from "./metrics";
import {
  GlobalPreferencesRequest,
  LoggedRequest,
  OptionalLoggedRequest,
  SpotifyRequest,
} from "./types";

export class ValidationError extends YourSpotifyError {
  type = "MALFORMED" as const;

  constructor(validationError: Error) {
    super("Validation error", { cause: validationError });
  }
}

class NotLoggedError extends YourSpotifyError {
  type = "UNAUTHORIZED" as const;
  code = "NOT_LOGGED";
}

class NotAdminError extends YourSpotifyError {
  type = "FORBIDDEN" as const;
  code = "NOT_ADMIN";
}

export const validate = <
  Z extends z.ZodObject | z.ZodDiscriminatedUnion<any, any>,
>(
  payload: any,
  schema: Z,
): z.infer<Z> => {
  try {
    let value;
    if ("extend" in schema) {
      value = schema.extend({ token: z.string().optional() }).parse(payload);
    } else {
      value = schema
        .and(z.object({ token: z.string().optional() }))
        .parse(payload);
    }
    return value;
  } catch (e) {
    logger.error(e);
    throw new ValidationError(e);
  }
};

// Behind an HTTPS reverse proxy req.secure is false (no "trust proxy"), so the
// public API URL decides whether cookies need the Secure flag.
export const needsSecureCookies = (req: Request) =>
  req.secure || new URL(get("API_ENDPOINT")).protocol === "https:";

// The cookie gets an expiry date matching the token. Without one the browser
// drops it when it closes, which sent everyone back through Spotify, and
// during a Spotify ban locked them out of stats that only need the database.
export function storeSessionCookie(
  req: Request,
  res: Response,
  userId: string,
  jwtPrivateKey: string,
) {
  const token = sign({ userId }, jwtPrivateKey, {
    expiresIn: getWithDefault("COOKIE_VALIDITY_MS", "30d") as `${number}`,
  });
  const { exp } = decode(token) as { exp: number };
  res.cookie("token", token, {
    sameSite: "strict",
    httpOnly: true,
    secure: needsSecureCookies(req),
    expires: new Date(exp * 1000),
  });
}

const baselogged = async (
  req: Request,
  res: Response,
  useQueryToken = false,
) => {
  const { token: queryToken } = req.query;

  if (useQueryToken && queryToken && typeof queryToken === "string") {
    const user = await getUserFromField("publicToken", queryToken, false);
    if (user) {
      (req as LoggedRequest).isGuest = true;
      return user;
    }
  }

  const auth = req.cookies.token;
  if (!auth) {
    return null;
  }

  try {
    const privateData = await getPrivateData();
    if (!privateData?.jwtPrivateKey) {
      throw new Error("No private data found, cannot sign JWT");
    }
    const jwtUser = verify(auth, privateData.jwtPrivateKey) as {
      userId: string;
      iat?: number;
      exp?: number;
    };

    if (typeof jwtUser.userId !== "string") {
      return null;
    }

    const user = await getUserFromField(
      "_id",
      new Types.ObjectId(jwtUser.userId),
      false,
    );

    if (!user) {
      return null;
    }
    // Past half of its lifetime the session is renewed, so a device that is
    // used regularly never has to go through Spotify again.
    const { iat, exp } = jwtUser;
    if (iat && exp && Date.now() / 1000 > iat + (exp - iat) / 2) {
      storeSessionCookie(req, res, jwtUser.userId, privateData.jwtPrivateKey);
    }
    return user;
  } catch {
    return null;
  }
};

export const logged = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = await baselogged(req, res, false);
  if (!user) {
    throw new NotLoggedError();
  }
  (req as LoggedRequest).user = user;
  next();
};

export const isLoggedOrGuest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = await baselogged(req, res, true);
  if (!user) {
    throw new NotLoggedError();
  }
  (req as LoggedRequest).user = user;
  next();
};

export const optionalLoggedOrGuest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = await baselogged(req, res, true);
  (req as OptionalLoggedRequest).user = user;
  next();
};

export const optionalLogged = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = await baselogged(req, res, false);
  (req as OptionalLoggedRequest).user = user;
  next();
};

export const admin = (req: Request, res: Response, next: NextFunction) => {
  const { user } = req as LoggedRequest;

  if (!user) {
    throw new NotLoggedError();
  }

  if (!user.admin) {
    throw new NotAdminError();
  }
  next();
};

export const withHttpClient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = req as LoggedRequest;

  const client = new SpotifyAPI(user._id.toString());
  (req as SpotifyRequest & LoggedRequest).client = client;
  next();
};

export const withGlobalPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pref = await getGlobalPreferences();
    if (!pref) {
      logger.error(
        "No global preferences, this is critical, try restarting the app",
      );
      return;
    }
    (req as GlobalPreferencesRequest).globalPreferences = pref;
    next();
  } catch {
    res.status(500).end();
  }
};

class AlreadyImportingError extends YourSpotifyError {
  type = "CONFLICT" as const;
  code = "ALREADY_IMPORTING";
}

export const notAlreadyImporting = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = req as LoggedRequest;
  const imports = await getUserImporterState(user._id.toString());
  if (imports.some((imp) => imp.status === "progress")) {
    throw new AlreadyImportingError();
  }
  next();
};

const MEASURE_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

export const measureRequestDuration = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!MEASURE_METHODS.includes(req.method)) {
    return next();
  }
  const endpoint = req.path;
  const start = hrtime.bigint();
  res.on("finish", () => {
    const duration = Number(hrtime.bigint() - start);
    Metrics.httpRequestDurationNanoseconds
      .labels(req.method, endpoint, res.statusCode.toString())
      .set(duration);
    Metrics.httpRequestsTotal
      .labels(req.method, endpoint, res.statusCode.toString())
      .inc();
  });
  next();
};

class AffinityNotAllowedError extends YourSpotifyError {
  type = "UNAUTHORIZED" as const;
  code = "AFFINITY_NOT_ALLOWED";

  constructor() {
    super("Affinity is not allowed");
  }
}

export const checkAffinityAllowed = async () => {
  const globalPreferences = await getGlobalPreferences();
  if (!globalPreferences?.allowAffinity) {
    throw new AffinityNotAllowedError();
  }
};

export const affinityAllowed = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  await checkAffinityAllowed();
  next();
};
