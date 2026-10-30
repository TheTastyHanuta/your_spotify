import { Interval } from "../../../intervals";

export type DarkModeType = "light" | "dark" | "follow";
export interface User {
  username: string;
  admin: boolean;
  _id: string;
  id: string;
  expiresIn: number;
  // Stripped by the server before being sent to the client
  accessToken?: string | null;
  refreshToken?: string | null;
  spotifyAuthDate?: string;
  spotifyReauthRequired?: boolean;
  // Not from the account: the Spotify ban in force on the server, from /me
  spotifyBlock?: { until: string; kind: "ban" | "quota" } | null;
  lastTimestamp: number;
  tracks: string[];
  settings: {
    historyLine: boolean;
    preferredStatsPeriod: string;
    nbElements: number;
    metricUsed: "number" | "duration";
    darkMode: DarkModeType;
    timezone: string | null | undefined;
    dateFormat: string;
    // 0 is Sunday, 1 is Monday. Missing on accounts that never changed it
    weekStartsOn?: number;
    blacklistedArtists: string[] | undefined;
  };
  publicToken: string | null;
  firstListenedAt: string;
  isGuest: boolean;
}

export interface ReduxPresetIntervalDetail {
  type: "preset";
  index: number;
}

export interface ReduxCustomIntervalDetail {
  type: "custom";
  interval: Interval;
}

export interface ReduxUserBasedIntervalDetails {
  type: "userbased";
  index: number;
}

export type ReduxIntervalDetail =
  | ReduxPresetIntervalDetail
  | ReduxCustomIntervalDetail
  | ReduxUserBasedIntervalDetails;
