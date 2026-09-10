import mongoose, { PipelineStage } from "mongoose";

import { uniq } from "../../tools/misc";
import { InfosModel } from "../Models";
import {
  basicMatchUsers,
  lightAlbumLookupPipeline,
  lightArtistLookupPipeline,
  lightTrackLookupPipeline,
} from "./statsTools";

function fromPairs<K extends string, V>(pairs: [K, V][]) {
  return pairs.reduce<Record<K, V>>(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<K, V>,
  );
}

export enum CollaborativeMode {
  AVERAGE = "average",
  MINIMA = "minima",
}

// Ranks the items grouped by `groupField` by the share of each user's listens
// they represent. The per-user totals come from a query of their own: getting
// them in the same pipeline meant pushing every listen of every user into a
// single document, which fails past MongoDB's 100MB $push memory limit.
const getCollaborativeRankingStages = async (
  _users: string[],
  start: Date,
  end: Date,
  mode: CollaborativeMode,
  groupField: string,
  limit: number,
): Promise<PipelineStage[]> => {
  // A user listed twice would weigh twice in the average.
  const users = uniq(_users).map((u) => new mongoose.Types.ObjectId(u));
  const match = basicMatchUsers(users, start, end);
  const totals = await InfosModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([{ $match: match }, { $group: { _id: "$owner", count: { $sum: 1 } } }]);
  const totalOf = (user: mongoose.Types.ObjectId) =>
    totals.find((total) => total._id.equals(user))?.count ?? 0;

  return [
    { $match: match },
    {
      $group: {
        _id: `$${groupField}`,
        ...fromPairs(
          users.map((user) => [
            user.toString(),
            { $sum: { $cond: [{ $eq: ["$owner", user] }, 1, 0] } },
          ]),
        ),
      },
    },
    {
      $addFields: fromPairs(
        users.map((user) => {
          const total = totalOf(user);
          // A user without listens in the range has a share of 0 everywhere,
          // dividing by their total would make MongoDB reject the query.
          return [
            `percent_${user.toString()}`,
            total > 0
              ? { $divide: [`$${user.toString()}`, total] }
              : { $literal: 0 },
          ];
        }),
      ),
    },
    {
      $addFields: {
        average_percents: {
          $divide: [
            { $sum: users.map((user) => `$percent_${user.toString()}`) },
            users.length,
          ],
        },
        minima: { $min: users.map((user) => `$percent_${user.toString()}`) },
      },
    },
    {
      $sort: {
        [mode === CollaborativeMode.AVERAGE ? "average_percents" : "minima"]:
          -1,
      },
    },
    { $limit: limit },
  ];
};

export const getCollaborativeBestSongs = async (
  users: string[],
  start: Date,
  end: Date,
  mode: CollaborativeMode,
  limit: number,
) =>
  InfosModel.aggregate([
    ...(await getCollaborativeRankingStages(
      users,
      start,
      end,
      mode,
      "id",
      limit,
    )),
    { $lookup: lightTrackLookupPipeline("_id") },
    { $unwind: "$track" },
    { $lookup: lightAlbumLookupPipeline() },
    { $unwind: "$album" },
    { $lookup: lightArtistLookupPipeline() },
    { $unwind: "$artist" },
  ]);

export const getCollaborativeBestAlbums = async (
  users: string[],
  start: Date,
  end: Date,
  mode: CollaborativeMode,
) =>
  InfosModel.aggregate([
    // Group on the album the listen was recorded against, not the album of
    // the canonical track. After an ISRC merge those differ, and using the
    // canonical one reattributes singles and alternate releases. Ordinary
    // album stats already use albumId.
    ...(await getCollaborativeRankingStages(
      users,
      start,
      end,
      mode,
      "albumId",
      50,
    )),
    { $lookup: lightAlbumLookupPipeline("_id") },
    { $unwind: "$album" },
    { $lookup: lightArtistLookupPipeline("album.artists") },
    { $unwind: "$artist" },
  ]);

export const getCollaborativeBestArtists = async (
  users: string[],
  start: Date,
  end: Date,
  mode: CollaborativeMode,
) =>
  InfosModel.aggregate([
    // Same reasoning as the album variant: primaryArtistId is who was
    // credited when the listen happened, the canonical track's first artist
    // can be someone else entirely.
    ...(await getCollaborativeRankingStages(
      users,
      start,
      end,
      mode,
      "primaryArtistId",
      50,
    )),
    { $lookup: lightArtistLookupPipeline("_id", false) },
    { $unwind: "$artist" },
  ]);
