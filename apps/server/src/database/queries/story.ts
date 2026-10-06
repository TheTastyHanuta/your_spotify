import { InfosModel } from "../Models";
import { User } from "../schemas/user";
import { allListens, findArtists, findTracks, keepOrder } from "./discoveries";
import { DAY_MS } from "./insights";
import { getTimezone } from "./statsTools";

// Only aggregation features of MongoDB 4.4 are used here, some instances
// cannot run a newer MongoDB.

// Whole history queries for the "Your story" page

const FORGOTTEN_MIN_PLAYS = 10;
const NB_FORGOTTEN_TRACKS = 20;
const NB_FORGOTTEN_ARTISTS = 10;

type Forgotten = {
  _id: string;
  total: number;
  last: Date;
  // "YYYY-MM" in the stats timezone, and its plays
  peak: string;
  peakPlays: number;
};

// Most played songs or artists of all time not played for `days` days
const forgottenOf = (
  user: User,
  field: "id" | "primaryArtistId",
  since: Date,
  nb: number,
): Promise<Forgotten[]> =>
  InfosModel.aggregate([
    allListens(user),
    {
      $group: {
        _id: {
          item: `$${field}`,
          month: {
            $dateToString: {
              format: "%Y-%m",
              date: "$played_at",
              timezone: getTimezone(user.settings.timezone),
            },
          },
        },
        plays: { $sum: 1 },
        last: { $max: "$played_at" },
      },
    },
    // Busiest month first, the earliest one on ties, for $first
    { $sort: { plays: -1, "_id.month": 1 } },
    {
      $group: {
        _id: "$_id.item",
        total: { $sum: "$plays" },
        last: { $max: "$last" },
        peak: { $first: "$_id.month" },
        peakPlays: { $first: "$plays" },
      },
    },
    { $match: { last: { $lt: since }, total: { $gte: FORGOTTEN_MIN_PLAYS } } },
    { $sort: { total: -1, _id: 1 } },
    { $limit: nb },
  ]);

const withoutId = ({ _id, ...rest }: Forgotten) => rest;

export const getForgotten = async (user: User, days: number) => {
  const since = new Date(Date.now() - days * DAY_MS);
  const [tracks, artists] = await Promise.all([
    forgottenOf(user, "id", since, NB_FORGOTTEN_TRACKS),
    forgottenOf(user, "primaryArtistId", since, NB_FORGOTTEN_ARTISTS),
  ]);
  const [trackDocs, artistDocs] = await Promise.all([
    findTracks(tracks.map((t) => t._id)),
    findArtists(artists.map((a) => a._id)),
  ]);
  return {
    tracks: keepOrder(
      tracks.map((t) => t._id),
      trackDocs,
      (track, index) => ({ track, ...withoutId(tracks[index]!) }),
    ),
    artists: keepOrder(
      artists.map((a) => a._id),
      artistDocs,
      (artist, index) => ({ artist, ...withoutId(artists[index]!) }),
    ),
  };
};
