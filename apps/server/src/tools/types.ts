import { Request } from "express";

import { GlobalPreferences } from "../database/schemas/globalPreference";
import { User } from "../database/schemas/user";
import { SpotifyAPI } from "./apis/spotifyApi";

export interface GlobalPreferencesRequest extends Request {
  globalPreferences: GlobalPreferences;
}

export interface LoggedRequest extends Request {
  user: User;
  // Set when the user comes from a share link (public token), not a login
  isGuest?: boolean;
}

export interface OptionalLoggedRequest extends Request {
  user: User | null;
}

export interface SpotifyRequest extends Request {
  client: SpotifyAPI;
}

export enum Timesplit {
  all = "all",
  hour = "hour",
  day = "day",
  week = "week",
  month = "month",
  year = "year",
}

export type Unpack<T> = T extends (infer U)[] ? U : T;
