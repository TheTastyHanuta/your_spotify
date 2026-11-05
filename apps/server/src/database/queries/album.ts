import { resolveEntries } from "../../tools/albumTracklist/match";
import { primaryIdOf } from "../../tools/canonicalTracks";
import { escapeRegExp } from "../../tools/misc";
import { bestNameMatches } from "../../tools/search";
import {
  AlbumModel,
  AlbumTracklistModel,
  InfosModel,
  TrackModel,
} from "../Models";
import { notRemoved } from "../schemas/info";
import { User } from "../schemas/user";
import { findMergedIntoTracks } from "./track";

export const getAlbums = (albumsId: string[]) =>
  AlbumModel.find({ id: { $in: albumsId } });

export const searchAlbum = async (str: string) => {
  const albums = await AlbumModel.find({
    name: { $regex: new RegExp(escapeRegExp(str), "i") },
  });
  return AlbumModel.populate(bestNameMatches(albums, str), {
    path: "full_artists",
  });
};

export const getFirstAndLastListenedAlbum = async (
  user: User,
  albumId: string,
) => {
  const res = await InfosModel.aggregate([
    { $match: { owner: user._id, albumId: albumId, ...notRemoved } },
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
      ])
      .flat(1),
  ]);
  return res[0];
};

export const getAlbumSongs = async (user: User, albumId: string) => {
  const res = await InfosModel.aggregate([
    { $match: { owner: user._id, albumId: albumId, ...notRemoved } },
    { $group: { _id: "$id", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    {
      $lookup: {
        from: "tracks",
        localField: "_id",
        foreignField: "id",
        as: "track",
      },
    },
    { $unwind: "$track" },
  ]);
  return res;
};

// The album's songs (from its tracklist, and the ones played from it) as the
// current primaries
const albumSongIds = async (albumId: string) => {
  const tracklist = await AlbumTracklistModel.findOne({ albumId }).lean();
  const entries = tracklist?.entries ?? [];
  const stored = await TrackModel.find(
    { id: { $in: entries.map((entry) => entry.id) } },
    { id: 1, mergedInto: 1 },
  ).lean();
  const chains = await findMergedIntoTracks(stored);
  const storedById = new Map([...stored, ...chains].map((t) => [t.id, t]));
  const storedIds = new Set(stored.map((track) => track.id));
  const unknown = entries.filter((entry) => !storedIds.has(entry.id));
  const primaries = unknown.length
    ? await TrackModel.find(
        {
          // Any position, so the artists index is used; isSameSong checks the
          // first artist
          artists: { $in: [...new Set(unknown.map((entry) => entry.artist))] },
          mergedInto: { $exists: false },
        },
        { id: 1, name: 1, duration_ms: 1, artists: 1 },
      ).lean()
    : [];
  return resolveEntries(
    entries,
    storedIds,
    (id) => primaryIdOf(storedById.get(id)!, storedById),
    primaries,
  );
};

// Plays of the album's songs that came from other releases (mostly singles).
// The album page's song list ranks songs by all their plays and notes these;
// the album's own numbers (plays, rank, Top albums) never count them.
// playedHere: the songs played from the album (getAlbumSongs).
// onlyElsewhere: the album's songs never played from it, only from elsewhere.
export const getAlbumElsewhere = async (
  user: User,
  albumId: string,
  playedHere: string[],
) => {
  const listed = await albumSongIds(albumId);
  const elsewhere = await InfosModel.aggregate<{
    trackId: string;
    count: number;
    album: { id: string; name: string; album_type: string };
  }>([
    {
      $match: {
        owner: user._id,
        id: { $in: [...new Set([...listed, ...playedHere])] },
        albumId: { $ne: albumId },
        ...notRemoved,
      },
    },
    { $group: { _id: { id: "$id", albumId: "$albumId" }, count: { $sum: 1 } } },
    { $sort: { count: -1, "_id.albumId": 1, "_id.id": 1 } },
    {
      $lookup: {
        from: "albums",
        localField: "_id.albumId",
        foreignField: "id",
        as: "album",
      },
    },
    { $unwind: "$album" },
    {
      $project: {
        _id: 0,
        trackId: "$_id.id",
        count: 1,
        album: { id: 1, name: 1, album_type: 1 },
      },
    },
  ]);
  const here = new Set(playedHere);
  const onlyElsewhereIds = [
    ...new Set(
      elsewhere.flatMap((e) =>
        listed.has(e.trackId) && !here.has(e.trackId) ? [e.trackId] : [],
      ),
    ),
  ];
  const onlyElsewhere = onlyElsewhereIds.length
    ? await TrackModel.find({ id: { $in: onlyElsewhereIds } })
    : [];
  return { elsewhere, onlyElsewhere };
};
