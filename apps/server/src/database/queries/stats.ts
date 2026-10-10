import { Types } from "mongoose";

import { Timesplit } from "../../tools/types";
import { AlbumModel, InfosModel, TrackModel } from "../Models";
import { User } from "../schemas/user";
import { longestSessions } from "./sessions";
import {
  basicMatch,
  getDateParts,
  getGroupingByTimeSplit,
  getTrackSortType,
  getTrackSumType,
  lightAlbumLookupPipeline,
  lightArtistLookupPipeline,
  lightTrackLookupPipeline,
  sortByTimeSplit,
} from "./statsTools";

export type ItemType = { field: string; collection: string };

export const ItemType = {
  track: { field: "$id", collection: "tracks" },
  album: { field: "$albumId", collection: "albums" },
  artist: { field: "$primaryArtistId", collection: "artists" },
} as const satisfies Record<string, ItemType>;

export const getMostListenedSongs = async (
  user: User,
  start: Date,
  end: Date,
  timeSplit: Timesplit = Timesplit.hour,
) => {
  const res = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $project: {
        parts: getDateParts(user.settings.timezone, timeSplit),
        id: 1,
      },
    },

    {
      $group: {
        _id: { ...getGroupingByTimeSplit(timeSplit, "parts"), track: "$id" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, "_id.track": 1 } },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "_id"),
        tracks: { $push: "$_id.track" },
        counts: { $push: "$count" },
      },
    },
    {
      $project: {
        _id: 1,
        tracks: { $slice: ["$tracks", user.settings.nbElements] },
        counts: { $slice: ["$counts", user.settings.nbElements] },
      },
    },
    { $unwind: { path: "$tracks", includeArrayIndex: "trackIdx" } },
    {
      $lookup: {
        from: "tracks",
        localField: "tracks",
        foreignField: "id",
        as: "tracks",
      },
    },
    { $unwind: "$tracks" },
    {
      $lookup: {
        from: "albums",
        localField: "tracks.album",
        foreignField: "id",
        as: "tracks.album",
      },
    },
    { $unwind: "$tracks.album" },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "_id"),
        tracks: { $push: "$tracks" },
        counts: { $push: { $arrayElemAt: ["$counts", "$trackIdx"] } },
      },
    },
    ...sortByTimeSplit(timeSplit, "_id"),
  ]);
  return res;
};

export const getSongsPer = async (
  user: User,
  start: Date,
  end: Date,
  timeSplit = Timesplit.day,
) => {
  const res = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $project: {
        parts: getDateParts(user.settings.timezone, timeSplit),
        id: 1,
        primaryArtistId: 1,
      },
    },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "parts"),
        count: { $sum: 1 },
        songs: { $addToSet: "$id" },
        artists: { $addToSet: "$primaryArtistId" },
      },
    },
    {
      $project: {
        count: 1,
        differents: { $size: "$songs" },
        differentArtists: { $size: "$artists" },
      },
    },
    ...sortByTimeSplit(timeSplit, "_id"),
  ]);
  return res;
};

export const getTimePer = async (
  user: User,
  start: Date,
  end: Date,
  timeSplit = Timesplit.day,
) => {
  const res = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $project: {
        parts: getDateParts(user.settings.timezone, timeSplit),
        durationMs: 1,
        id: 1,
      },
    },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "parts"),
        count: { $sum: "$durationMs" },
      },
    },
    ...sortByTimeSplit(timeSplit, "_id"),
  ]);
  return res;
};

export const getDayRepartition = async (user: User, start: Date, end: Date) => {
  const res = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $project: {
        parts: getDateParts(user.settings.timezone, Timesplit.hour),
        durationMs: 1,
        id: 1,
      },
    },
    {
      $group: {
        _id: "$parts.hour",
        count: { $sum: getTrackSumType(user, "$durationMs") },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return res;
};

export const getBestArtistsPer = async (
  user: User,
  start: Date,
  end: Date,
  timeSplit = Timesplit.day,
) => {
  // infos already carries `primaryArtistId` and `durationMs`, so the per-play
  // `tracks` lookup is unnecessary.
  const res = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $project: {
        parts: getDateParts(user.settings.timezone, timeSplit),
        primaryArtistId: 1,
        durationMs: 1,
      },
    },
    {
      $group: {
        _id: {
          ...getGroupingByTimeSplit(timeSplit, "parts"),
          art: "$primaryArtistId",
        },
        count: { $sum: getTrackSumType(user, "$durationMs") },
      },
    },
    { $sort: { count: -1, "_id.art": 1 } },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "_id"),
        artists: { $push: "$_id.art" },
        counts: { $push: "$count" },
      },
    },
    {
      $project: {
        _id: 1,
        artists: { $slice: ["$artists", user.settings.nbElements] },
        counts: { $slice: ["$counts", user.settings.nbElements] },
      },
    },
    { $unwind: { path: "$artists", includeArrayIndex: "artIdx" } },
    {
      $lookup: {
        from: "artists",
        localField: "artists",
        foreignField: "id",
        as: "artists",
      },
    },
    { $unwind: "$artists" },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit, "_id"),
        artists: { $push: "$artists" },
        counts: { $push: { $arrayElemAt: ["$counts", "$artIdx"] } },
      },
    },
    ...sortByTimeSplit(timeSplit, "_id"),
  ]);
  return res;
};

export const getBest = (
  itemType: ItemType,
  user: User,
  start: Date,
  end: Date,
  nb: number,
  offset: number,
) =>
  InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $group: {
        _id: itemType.field,
        duration_ms: { $sum: "$durationMs" },
        count: { $sum: 1 },
        trackId: { $first: "$id" },
        albumId: { $first: "$albumId" },
        primaryArtistId: { $first: "$primaryArtistId" },
        trackIds: { $addToSet: "$id" },
      },
    },
    { $addFields: { differents: { $size: "$trackIds" } } },
    {
      $facet: {
        infos: [
          { $sort: { [getTrackSortType(user)]: -1, _id: 1 } },
          { $skip: offset },
          { $limit: nb },
        ],
        computations: [
          {
            $group: {
              _id: null,
              total_duration_ms: { $sum: "$duration_ms" },
              total_count: { $sum: "$count" },
            },
          },
        ],
      },
    },
    { $unwind: "$infos" },
    { $unwind: "$computations" },
    {
      $project: {
        _id: "$infos._id",
        result: { $mergeObjects: ["$infos", "$computations"] },
      },
    },
    {
      $replaceRoot: {
        newRoot: { $mergeObjects: ["$result", { _id: "$_id" }] },
      },
    },
    { $lookup: lightTrackLookupPipeline("trackId") },
    { $unwind: "$track" },
    {
      $lookup: lightAlbumLookupPipeline(
        itemType === ItemType.album ? "albumId" : "track.album",
      ),
    },
    { $unwind: "$album" },
    { $lookup: lightArtistLookupPipeline("primaryArtistId", false) },
    { $unwind: "$artist" },
    {
      $lookup: {
        from: "artists",
        localField: "track.artists",
        foreignField: "id",
        as: "track_artists",
      },
    },
    {
      $lookup: {
        from: "artists",
        localField: "album.artists",
        foreignField: "id",
        as: "album_artists",
      },
    },
  ]);

export const getLongestListeningSession = async (
  userId: string,
  start: Date,
  end: Date,
  nb: number,
) => {
  const sessionBreakThreshold = 10 * 60 * 1000;

  // Split in code: MongoDB 4.4 has no $setWindowFields, and the earlier
  // $reduce version was O(N²).
  // ponytail: loads the period's plays into memory (~124k for years of
  // listening), page through them if a period ever gets far bigger.
  const plays = await InfosModel.aggregate<{
    _id: Types.ObjectId;
    owner: Types.ObjectId;
    id: string;
    albumId: string;
    primaryArtistId: string;
    artistIds: string[];
    durationMs: number;
    played_at: Date;
  }>([
    ...basicMatch(userId, start, end),
    { $sort: { played_at: 1 } },
    {
      $project: {
        owner: 1,
        id: 1,
        albumId: 1,
        primaryArtistId: 1,
        artistIds: 1,
        durationMs: 1,
        played_at: 1,
      },
    },
  ]);

  const longest = longestSessions(plays, sessionBreakThreshold, nb);

  const infos = longest.flatMap((session) => session.plays);
  const [tracks, albums] = await Promise.all([
    TrackModel.find({ id: { $in: [...new Set(infos.map((i) => i.id))] } }),
    AlbumModel.find({ id: { $in: [...new Set(infos.map((i) => i.albumId))] } }),
  ]);
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const albumById = new Map(albums.map((album) => [album.id, album]));

  return longest.map((session) => ({
    ...session,
    full_tracks: Object.fromEntries(
      session.plays.flatMap((i) =>
        trackById.has(i.id) ? [[i.id, trackById.get(i.id)]] : [],
      ),
    ),
    full_albums: Object.fromEntries(
      session.plays.flatMap((i) =>
        albumById.has(i.albumId) ? [[i.albumId, albumById.get(i.albumId)]] : [],
      ),
    ),
  }));
};

export const getRankOf = async (
  itemType: ItemType,
  user: User,
  itemId: string,
) => {
  const res = await InfosModel.aggregate([
    { $match: { owner: user._id } },
    { $group: { _id: itemType.field, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $group: { _id: 1, array: { $push: { id: "$_id", count: "$count" } } } },
    { $project: { index: { $indexOfArray: ["$array.id", itemId] }, array: 1 } },
    {
      $project: {
        index: 1,
        isMax: {
          $cond: { if: { $eq: ["$index", 0] }, then: true, else: false },
        },
        isMin: {
          $cond: {
            if: { $eq: ["$index", { $subtract: [{ $size: "$array" }, 1] }] },
            then: true,
            else: false,
          },
        },
        results: {
          $slice: ["$array", { $max: [{ $subtract: ["$index", 1] }, 0] }, 3],
        },
      },
    },
  ]);
  return res[0];
};
