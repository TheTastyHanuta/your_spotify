import { Schema } from "mongoose";

import { UsageHour } from "../../tools/spotifyUsage/summary";

// One document per UTC hour with the Spotify requests sent in it, kept for
// 13 weeks: the longest range the admin view shows is 12 weeks.
export const SpotifyUsageSchema = new Schema<UsageHour>(
  {
    hour: { type: Date, required: true, unique: true, expires: "91d" },
    sources: { type: Schema.Types.Mixed, default: {} },
    outcomes: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false },
);
