import { Types, UpdateQuery } from "mongoose";

import { MergeGroup, PlanTrack, planMerge } from "../../tools/isrcMerge/plan";
import { chunk } from "../../tools/misc";
import {
  AlbumModel,
  ArtistModel,
  InfosModel,
  IsrcLookupModel,
  IsrcMergeJobModel,
  TrackModel,
} from "../Models";
import { IsrcMergeJob } from "../schemas/isrcMerge";
import { SpotifyImage } from "../schemas/types";

const UPDATE_BATCH_SIZE = 1000;
const MAX_REPOINT_PASSES = 10;

const withoutIsrc = {
  mergedInto: { $exists: false },
  $or: [{ isrc: null }, { isrc: "" }],
};

// Tracks stored without an ISRC that Spotify was not asked about yet
const toLookUpPipeline = () => [
  { $match: withoutIsrc },
  {
    $lookup: {
      from: IsrcLookupModel.collection.name,
      localField: "id",
      foreignField: "trackId",
      as: "lookup",
    },
  },
  { $match: { lookup: { $size: 0 } } },
];

export const getTrackIdsToLookUp = async (limit: number) => {
  const tracks = await TrackModel.aggregate<{ id: string }>([
    ...toLookUpPipeline(),
    { $limit: limit },
    { $project: { _id: 0, id: 1 } },
  ]);
  return tracks.map((track) => track.id);
};

export const storeIsrcLookup = async (trackId: string, isrc: string | null) => {
  await IsrcLookupModel.updateOne(
    { trackId },
    { $set: { isrc, fetchedAt: new Date() } },
    { upsert: true },
  );
};

export const getLookupProgress = async () => {
  const [remaining] = await TrackModel.aggregate<{ count: number }>([
    ...toLookUpPipeline(),
    { $count: "count" },
  ]);
  const [found, none] = await Promise.all([
    IsrcLookupModel.countDocuments({ isrc: { $ne: null } }),
    IsrcLookupModel.countDocuments({ isrc: null }),
  ]);
  return {
    checked: found + none,
    found,
    none,
    remaining: remaining?.count ?? 0,
  };
};

export type LookupProgress = Awaited<ReturnType<typeof getLookupProgress>>;

// The job document is a singleton under this unique key, so two admins
// starting at once still share one
const JOB = { key: "job" as const };

export const getIsrcMergeJob = () => IsrcMergeJobModel.findOne(JOB);

// Starts the lookups, or restarts them after a stop, as this admin
export const startIsrcMergeJob = (userId: Types.ObjectId) =>
  IsrcMergeJobModel.updateOne(
    JOB,
    { $set: { startedBy: userId }, $unset: { stoppedReason: 1 } },
    { upsert: true },
  );

export const updateIsrcMergeJob = (update: UpdateQuery<IsrcMergeJob>) =>
  IsrcMergeJobModel.updateOne(JOB, update);

// Only one apply runs at a time, a second request finds the flag set
export const claimIsrcMergeApply = () =>
  IsrcMergeJobModel.findOneAndUpdate(
    { ...JOB, applying: { $ne: true } },
    { $set: { applying: true } },
  );

const getPlayCounts = async (trackIds: string[]) => {
  const playsById = new Map<string, number>();
  for (const batch of chunk(trackIds, UPDATE_BATCH_SIZE)) {
    const counts = await InfosModel.aggregate<{ _id: string; count: number }>([
      { $match: { id: { $in: batch } } },
      { $group: { _id: "$id", count: { $sum: 1 } } },
    ]);
    for (const { _id, count } of counts) {
      playsById.set(_id, count);
    }
  }
  return playsById;
};

const createdAtMs = (id: unknown) =>
  id instanceof Types.ObjectId
    ? id.getTimestamp().getTime()
    : Number.POSITIVE_INFINITY;

// Stored ISRCs are unique, so duplicates only come from the lookups: tracks
// whose looked up ISRC another looked up or stored track shares
const computePlan = async () => {
  const lookups = await IsrcLookupModel.find({ isrc: { $ne: null } }).lean();
  const lookedUpTracks = await TrackModel.find(
    { ...withoutIsrc, id: { $in: lookups.map((lookup) => lookup.trackId) } },
    { id: 1 },
  ).lean();
  const stillWithoutIsrc = new Set(lookedUpTracks.map((track) => track.id));
  const isrcById = new Map(
    lookups
      .filter((lookup) => stillWithoutIsrc.has(lookup.trackId))
      .map((lookup) => [lookup.trackId, lookup.isrc!]),
  );

  const storedSharingIsrc = await TrackModel.find(
    {
      isrc: { $in: [...new Set(isrcById.values())] },
      mergedInto: { $exists: false },
    },
    { id: 1, isrc: 1 },
  ).lean();
  for (const track of storedSharingIsrc) {
    isrcById.set(track.id, track.isrc!);
  }

  const idsByIsrc = new Map<string, string[]>();
  for (const [id, isrc] of isrcById) {
    const ids = idsByIsrc.get(isrc) ?? [];
    ids.push(id);
    idsByIsrc.set(isrc, ids);
  }
  const duplicateIds = [...idsByIsrc.values()]
    .filter((ids) => ids.length > 1)
    .flat();
  const toStore = [...isrcById.entries()]
    .filter(
      ([id, isrc]) =>
        stillWithoutIsrc.has(id) && idsByIsrc.get(isrc)!.length === 1,
    )
    .map(([trackId, isrc]) => ({ trackId, isrc }));

  const [plays, duplicateTracks] = await Promise.all([
    getPlayCounts(duplicateIds),
    TrackModel.find({ id: { $in: duplicateIds } }, { id: 1 }).lean(),
  ]);
  const planTracks: PlanTrack[] = duplicateTracks.map((track) => ({
    id: track.id,
    isrc: isrcById.get(track.id)!,
    plays: plays.get(track.id) ?? 0,
    createdAtMs: createdAtMs(track._id),
  }));
  return { groups: planMerge(planTracks), plays, toStore };
};

export interface TrackSummary {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumImages: SpotifyImage[];
  plays: number;
}

export interface MergeGroupDetails {
  isrc: string;
  primary: TrackSummary;
  secondaries: TrackSummary[];
}

export const buildMergePlan = async () => {
  const { groups, plays, toStore } = await computePlan();
  const ids = groups.flatMap((g) => [g.primaryId, ...g.secondaryIds]);
  const tracks = await TrackModel.find(
    { id: { $in: ids } },
    { id: 1, name: 1, album: 1, artists: 1 },
  ).lean();
  const [albums, artists] = await Promise.all([
    AlbumModel.find(
      { id: { $in: tracks.map((t) => t.album) } },
      { id: 1, name: 1, images: 1 },
    ).lean(),
    ArtistModel.find(
      { id: { $in: tracks.flatMap((t) => t.artists.slice(0, 1)) } },
      { id: 1, name: 1 },
    ).lean(),
  ]);
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const albumById = new Map(albums.map((a) => [a.id, a]));
  const artistName = new Map(artists.map((a) => [a.id, a.name]));
  const summary = (id: string): TrackSummary => {
    const track = trackById.get(id);
    return {
      id,
      name: track?.name ?? id,
      artist: artistName.get(track?.artists[0] ?? "") ?? "",
      album: albumById.get(track?.album ?? "")?.name ?? "",
      albumImages: albumById.get(track?.album ?? "")?.images ?? [],
      plays: plays.get(id) ?? 0,
    };
  };

  const details: MergeGroupDetails[] = groups.map((g) => ({
    isrc: g.isrc,
    primary: summary(g.primaryId),
    secondaries: g.secondaryIds.map(summary),
  }));
  return {
    groups: details,
    tracksToMerge: groups.reduce((n, g) => n + g.secondaryIds.length, 0),
    listensToRepoint: details.reduce(
      (n, g) => n + g.secondaries.reduce((m, s) => m + s.plays, 0),
      0,
    ),
    isrcsToStore: toStore.length,
  };
};

export type MergePlan = Awaited<ReturnType<typeof buildMergePlan>>;

const getSecondaryIdsByPrimaryId = async () => {
  const mergedTracks = await TrackModel.find(
    { mergedInto: { $exists: true, $ne: null } },
    { id: 1, mergedInto: 1 },
  ).lean();
  const secondaryIdsByPrimaryId = new Map<string, string[]>();
  for (const track of mergedTracks) {
    const group = secondaryIdsByPrimaryId.get(track.mergedInto!) ?? [];
    group.push(track.id);
    secondaryIdsByPrimaryId.set(track.mergedInto!, group);
  }
  return secondaryIdsByPrimaryId;
};

// The polling loop and the importers resolve a track id before they write the
// listen. A listen resolved just before its track was marked as merged can land
// on that secondary track after its listens were re-pointed, so every merged
// track is swept at the end, which also repairs earlier merges.
const repointListensOnMergedTracks = async () => {
  let repointed = 0;
  for (let pass = 0; pass < MAX_REPOINT_PASSES; pass += 1) {
    let repointedInPass = 0;
    for (const [
      primaryId,
      secondaryIds,
    ] of await getSecondaryIdsByPrimaryId()) {
      for (const batch of chunk(secondaryIds, UPDATE_BATCH_SIZE)) {
        const update = await InfosModel.updateMany(
          { id: { $in: batch } },
          { $set: { id: primaryId } },
        );
        repointedInPass += update.modifiedCount;
      }
    }
    repointed += repointedInPass;
    // A secondary pointing at another merged track resolves on the next pass
    if (repointedInPass === 0) {
      break;
    }
  }
  return repointed;
};

const mergeGroup = async ({ isrc, primaryId, secondaryIds }: MergeGroup) => {
  let listensRepointed = 0;
  let tracksMerged = 0;
  for (const batch of chunk(secondaryIds, UPDATE_BATCH_SIZE)) {
    const infos = await InfosModel.updateMany(
      { id: { $in: batch } },
      { $set: { id: primaryId } },
    );
    listensRepointed += infos.modifiedCount;
    // The ISRC index is unique, the secondaries give theirs up first
    const tracks = await TrackModel.updateMany(
      { id: { $in: batch }, mergedInto: { $exists: false } },
      { $set: { mergedInto: primaryId }, $unset: { isrc: "" } },
    );
    tracksMerged += tracks.modifiedCount;
  }
  // A merged track never keeps an ISRC, one left over by an older race would
  // fail the primary's write on the unique index
  await TrackModel.updateMany(
    { isrc, mergedInto: { $exists: true, $ne: null } },
    { $unset: { isrc: "" } },
  );
  await TrackModel.updateOne(
    { id: primaryId, mergedInto: { $exists: false } },
    { $set: { isrc } },
  );
  return { listensRepointed, tracksMerged };
};

// Plans again from the current data, so tracks and listens added since the
// preview are included
export const applyMergePlan = async () => {
  const { groups, toStore } = await computePlan();
  if (toStore.length > 0) {
    await TrackModel.bulkWrite(
      toStore.map(({ trackId, isrc }) => ({
        updateOne: {
          filter: { ...withoutIsrc, id: trackId },
          update: { $set: { isrc } },
        },
      })),
      { ordered: false },
    );
  }
  let listensRepointed = 0;
  let tracksMerged = 0;
  for (const group of groups) {
    const result = await mergeGroup(group);
    listensRepointed += result.listensRepointed;
    tracksMerged += result.tracksMerged;
  }
  listensRepointed += await repointListensOnMergedTracks();
  return { tracksMerged, listensRepointed };
};
