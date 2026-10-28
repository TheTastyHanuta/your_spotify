import { Schema, Types } from "mongoose";

// What Spotify answered for a track stored without an ISRC, null when it gave
// none. Kept apart from the tracks until the merge is applied: their ISRC
// index is unique, and an ISRC on a track changes which track new listens are
// matched to.
export interface IsrcLookup {
  trackId: string;
  isrc: string | null;
  fetchedAt: Date;
}

export const IsrcLookupSchema = new Schema<IsrcLookup>({
  trackId: { type: String, required: true, unique: true },
  isrc: { type: String, default: null },
  fetchedAt: { type: Date, required: true },
});

export type IsrcMergeStoppedReason = "reauth" | "user-missing";

export interface IsrcMergeApplyResult {
  at: Date;
  tracksMerged: number;
  listensRepointed: number;
}

// A single document, created when an admin starts the ISRC lookups
export interface IsrcMergeJob {
  key: "job";
  startedBy: Types.ObjectId;
  // Extra wait before each Spotify request, raised after every ban
  slowdownMs?: number;
  rateLimitedUntil?: Date;
  stoppedReason?: IsrcMergeStoppedReason;
  applying: boolean;
  lastApply?: IsrcMergeApplyResult;
}

export const IsrcMergeJobSchema = new Schema<IsrcMergeJob>({
  key: { type: String, default: "job", unique: true },
  startedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  slowdownMs: Number,
  rateLimitedUntil: Date,
  stoppedReason: { type: String, enum: ["reauth", "user-missing"] },
  applying: { type: Boolean, default: false },
  lastApply: new Schema<IsrcMergeApplyResult>(
    { at: Date, tracksMerged: Number, listensRepointed: Number },
    { _id: false },
  ),
});
