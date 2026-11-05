import { Schema } from "mongoose";

import { UsageSource } from "../../tools/spotifyUsage/summary";

// A ban, a quota block, or the short 429s of one endpoint and source that
// came within a few minutes of each other ("retried"). Kept 13 weeks, like
// the hourly counts.
export interface SpotifyLimitEvent {
  at: Date;
  lastAt: Date;
  kind: "ban" | "quota" | "retried";
  source: UsageSource;
  endpoint: string;
  // 429s in the group, and those whose retries ran out
  count: number;
  gaveUp: number;
  // When Spotify said a ban or quota block ends
  until?: Date;
  // Of the latest 429 in the group
  retryAfter: string | null;
  body: string;
  requests24h: Partial<Record<UsageSource, number>>;
  sinceBan: number | null;
}

export const SpotifyLimitEventSchema = new Schema<SpotifyLimitEvent>(
  {
    at: { type: Date, required: true, index: true, expires: "91d" },
    lastAt: { type: Date, required: true },
    kind: { type: String, enum: ["ban", "quota", "retried"], required: true },
    source: { type: String, required: true },
    endpoint: { type: String, required: true },
    count: { type: Number, default: 1 },
    gaveUp: { type: Number, default: 0 },
    until: Date,
    retryAfter: { type: String, default: null },
    body: { type: String, default: "" },
    requests24h: { type: Schema.Types.Mixed, default: {} },
    sinceBan: { type: Number, default: null },
  },
  { versionKey: false },
);
