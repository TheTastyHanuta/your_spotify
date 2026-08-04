import { Timesplit } from "../../tools/types";
import { ArtistModel, InfosModel } from "../Models";
import { User } from "../schemas/user";
import { getGroupByDateProjection, getGroupingByTimeSplit } from "./statsTools";

export const getArtists = (artistIds: string[]) =>
  ArtistModel.find({ id: { $in: artistIds } });

// Only artists the user has a listen credited to, so the album artists pulled
// in by the missing-artist repair job (composers, orchestras, cast recordings)
// stop showing up as results whose page then says "never listened". Matching on
// artistIds keeps featured artists searchable, like before that job worked.
export const searchArtist = async (user: User, str: string) => {
  const artists = await ArtistModel.find({
    name: { $regex: new RegExp(str, "i") },
  });
  const listened = new Set<string>(
    await InfosModel.distinct("artistIds", {
      owner: user._id,
      artistIds: { $in: artists.map((artist) => artist.id) },
    }),
  );
  return artists.filter((artist) => listened.has(artist.id));
};

// Same criterion as searchArtist, so every artist a search returns has stats to
// show: a listen counts for each artist credited on it, not only the primary
// one. Top pages still rank by primaryArtistId alone, so a featured artist can
// have listens here and no rank.
export const matchArtistListens = (user: User, artistId: string) => ({
  owner: user._id,
  artistIds: artistId,
});

export const getFirstAndLastListened = async (user: User, artistId: string) => {
  // Non sense to compute blacklist here
  const res = await InfosModel.aggregate([
    { $match: matchArtistListens(user, artistId) },
    { $sort: { played_at: 1 } },
    {
      $group: {
        _id: null,
        first: { $first: "$$ROOT" },
        last: { $last: "$$ROOT" },
      },
    },
    ...["first", "last"]
      .map((e) => [
        {
          $lookup: {
            from: "tracks",
            localField: `${e}.id`,
            foreignField: "id",
            as: `${e}.track`,
          },
        },
        { $unwind: `$${e}.track` },
        {
          $lookup: {
            from: "albums",
            localField: `${e}.track.album`,
            foreignField: "id",
            as: `${e}.track.album`,
          },
        },
        { $unwind: `$${e}.track.album` },
      ])
      .flat(1),
  ]);
  return res[0];
};

export const getMostListenedSongOfArtist = async (
  user: User,
  artistId: string,
  count: number,
) => {
  const res = await InfosModel.aggregate([
    // Non sense to compute blacklist here
    { $match: matchArtistListens(user, artistId) },
    { $group: { _id: "$id", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: count },
    {
      $lookup: {
        from: "tracks",
        localField: "_id",
        foreignField: "id",
        as: "track",
      },
    },
    { $unwind: "$track" },
    {
      $lookup: {
        from: "albums",
        localField: "track.album",
        foreignField: "id",
        as: "track.album",
      },
    },
    { $unwind: "$track.album" },
  ]);
  return res;
};

export const bestPeriodOfArtist = async (user: User, artistId: string) => {
  // Non sense to compute blacklist here
  const res = await InfosModel.aggregate([
    { $match: matchArtistListens(user, artistId) },
    { $project: getGroupByDateProjection(user.settings.timezone) },
    {
      $group: { _id: null, items: { $push: "$$CURRENT" }, total: { $sum: 1 } },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: getGroupingByTimeSplit(Timesplit.month, "items"),
        artist: { $last: "$items" },
        count: { $sum: 1 },
        total: { $last: "$total" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 2 },
  ]);
  return res;
};

export const getTotalListeningOfArtist = async (
  user: User,
  artistId: string,
) => {
  // Non sense to compute blacklist here
  const res = await InfosModel.aggregate([
    { $match: matchArtistListens(user, artistId) },
    {
      $group: { _id: 1, count: { $sum: 1 }, differents: { $addToSet: "$id" } },
    },
    { $unwind: "$differents" },
    {
      $group: {
        _id: "$_id",
        count: { $first: "$count" },
        differents: { $sum: 1 },
      },
    },
  ]);
  return res[0];
};

export const getMostListenedAlbumOfArtist = async (
  user: User,
  artistId: string,
) => {
  const res = await InfosModel.aggregate([
    { $match: matchArtistListens(user, artistId) },
    { $group: { _id: "$albumId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    {
      $lookup: {
        from: "albums",
        localField: "_id",
        foreignField: "id",
        as: "album",
      },
    },
    { $unwind: "$album" },
    { $limit: 10 },
  ]);
  return res;
};

export const getDayRepartitionOfArtist = (user: User, artistId: string) =>
  // Non sense to compute blacklist here
  InfosModel.aggregate([
    { $match: matchArtistListens(user, artistId) },
    { $addFields: getGroupByDateProjection(user.settings.timezone) },
    {
      $lookup: {
        from: "tracks",
        localField: "id",
        foreignField: "id",
        as: "track",
      },
    },
    { $unwind: "$track" },
    {
      $group: {
        _id: "$hour",
        count: { $sum: 1 },
        duration: { $sum: "$track.duration_ms" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
