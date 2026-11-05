import { escapeRegExp } from "../../tools/misc";
import { bestNameMatches } from "../../tools/search";
import { InfosModel, TrackModel } from "../Models";
import { notRemoved } from "../schemas/info";
import { Track } from "../schemas/track";
import { User } from "../schemas/user";

export const getTracks = (tracksId: string[]) =>
  TrackModel.find({ id: { $in: tracksId } });

// Only the best matches get their album and artists
export const searchTrack = async (str: string) => {
  const tracks = await TrackModel.find({
    name: { $regex: new RegExp(escapeRegExp(str), "i") },
    mergedInto: { $exists: false },
  });
  return TrackModel.populate(bestNameMatches(tracks, str), [
    { path: "full_album" },
    { path: "full_artists" },
  ]);
};

export const getTrackListenedCount = (user: User, trackId: string) =>
  InfosModel.where({
    owner: user._id,
    id: trackId,
    ...notRemoved,
  }).countDocuments();

export const getTrackFirstAndLastListened = async (
  user: User,
  trackId: string,
) => {
  const res = await InfosModel.aggregate([
    { $match: { owner: user._id, id: trackId, ...notRemoved } },
    { $sort: { played_at: 1 } },
    {
      $group: {
        _id: null,
        first: { $first: "$$ROOT" },
        last: { $last: "$$ROOT" },
      },
    },
  ]);
  return res[0];
};

export const getTrackRecentHistory = async (user: User, trackId: string) =>
  InfosModel.find()
    .where({ owner: user._id, id: trackId, ...notRemoved })
    // One more than the page shows, so it knows to link to the full history
    .limit(11)
    .sort({ played_at: -1 });

export const getTrackListenedAlbums = async (user: User, trackId: string) => {
  const res = await InfosModel.aggregate([
    { $match: { owner: user._id, id: trackId, ...notRemoved } },
    { $group: { _id: "$albumId", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    {
      $lookup: {
        from: "albums",
        localField: "_id",
        foreignField: "id",
        as: "album",
      },
    },
    { $unwind: "$album" },
  ]);
  return res;
};

export const getTrackBySpotifyId = (id: string) => TrackModel.findOne({ id });

export const checkBlacklistConsistency = () =>
  InfosModel.updateMany(
    { blacklistedBy: { $size: 0 } },
    { $unset: { blacklistedBy: 1 } },
  );

export const unblacklistByArtist = async (userId: string, artistId: string) => {
  const tracks = await TrackModel.find({ "artists.0": artistId });
  const trackIds = tracks.map((t) => t.id);
  await InfosModel.updateMany(
    {
      owner: userId,
      id: { $in: trackIds },
      blacklistedBy: { $elemMatch: { $eq: "artist" } },
    },
    { $pull: { blacklistedBy: "artist" } },
  );
  await InfosModel.updateMany(
    { owner: userId, blacklistedBy: { $size: 0 } },
    { $unset: { blacklistedBy: 1 } },
  );
};

export const blacklistByArtist = async (userId: string, artistId: string) => {
  const tracks = await TrackModel.find({ "artists.0": artistId });
  const trackIds = tracks.map((t) => t.id);
  return InfosModel.updateMany(
    { owner: userId, id: { $in: trackIds } },
    { $addToSet: { blacklistedBy: "artist" } },
  );
};

// The tracks the stored ones are merged into, following chains (a primary
// merged again later) to their end, so a version reaches the current primary
const MAX_CHAIN_PASSES = 10;
export const findMergedIntoTracks = async (
  storedTracks: Pick<Track, "id" | "mergedInto">[],
) => {
  const known = new Set(storedTracks.map((track) => track.id));
  const found: Track[] = [];
  let pending: Pick<Track, "id" | "mergedInto">[] = storedTracks;
  for (let pass = 0; pass < MAX_CHAIN_PASSES; pass += 1) {
    const ids = [
      ...new Set(
        pending.flatMap((track) =>
          track.mergedInto && !known.has(track.mergedInto)
            ? [track.mergedInto]
            : [],
        ),
      ),
    ];
    if (ids.length === 0) {
      break;
    }
    const tracks: Track[] = await TrackModel.find({ id: { $in: ids } });
    for (const track of tracks) {
      known.add(track.id);
      found.push(track);
    }
    pending = tracks;
    // A missing target is not looked up again
    ids.forEach((id) => known.add(id));
  }
  return found;
};
