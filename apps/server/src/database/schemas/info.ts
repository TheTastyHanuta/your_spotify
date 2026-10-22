import { Schema, Types } from "mongoose";

export interface Infos {
  owner: Types.ObjectId;
  id: string;
  albumId: string;
  primaryArtistId: string;
  artistIds: string[];
  durationMs: number;
  played_at: Date;
  // "artist": the artist is blacklisted, the listen still counts on the
  // artist's own pages. "listen": removed by the user, counts nowhere.
  blacklistedBy?: ("artist" | "listen")[];
}

// Leaves out the listens the user removed; the queries that skip every
// blacklisted listen (blacklistedBy: { $exists: 0 }) already leave them out.
export const notRemoved = { blacklistedBy: { $ne: "listen" as const } };

export const InfosSchema = new Schema<Infos>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User" },

    id: { type: String, index: true },
    albumId: { type: String, index: true },
    primaryArtistId: { type: String, index: true },
    artistIds: [{ type: String, index: true }],

    durationMs: { type: Number },

    played_at: { type: Date, index: true },
    blacklistedBy: {
      type: [String],
      enum: ["artist", "listen"],
      required: false,
      default: undefined,
    },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

InfosSchema.virtual("track", {
  ref: "Track",
  localField: "id",
  foreignField: "id",
  justOne: true,
});

InfosSchema.virtual("album", {
  ref: "Album",
  localField: "albumId",
  foreignField: "id",
  justOne: true,
});

InfosSchema.virtual("artist", {
  ref: "Artist",
  localField: "primaryArtistId",
  foreignField: "id",
  justOne: true,
});
