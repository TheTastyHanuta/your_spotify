import { Schema } from "mongoose";

import { SpotifyBlock } from "../../tools/spotifyUsage/summary";

export interface GlobalPreferences {
  allowRegistrations: boolean;
  allowAffinity: boolean;
  // The last Spotify ban, so a restart does not send requests into it
  spotifyBlock?: SpotifyBlock;
}

export const GlobalPreferencesSchema = new Schema<GlobalPreferences>({
  allowRegistrations: { type: Boolean, default: true },
  allowAffinity: { type: Boolean, default: true },
  // Left out of the preferences anyone can read
  spotifyBlock: {
    type: new Schema<SpotifyBlock>(
      { until: Date, kind: { type: String, enum: ["ban", "quota"] } },
      { _id: false },
    ),
    select: false,
  },
});
