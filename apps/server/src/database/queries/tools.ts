import { AlbumModel, InfosModel, TrackModel, UserModel } from "../Models";
import { Infos } from "../schemas/info";
import { Track } from "../schemas/track";

export const getAdminUser = () => UserModel.findOne({ admin: true });

export const getInfosWithoutTracks = () =>
  InfosModel.aggregate<Infos>([
    {
      $lookup: {
        from: "tracks",
        as: "full_track",
        localField: "id",
        foreignField: "id",
      },
    },
    { $unwind: { path: "$full_track", preserveNullAndEmptyArrays: true } },
    { $match: { full_track: null } },
  ]);

export const getTracksWithoutAlbum = () =>
  TrackModel.aggregate<Track>([
    {
      $lookup: {
        from: "albums",
        as: "full_album",
        localField: "album",
        foreignField: "id",
      },
    },
    { $unwind: { path: "$full_album", preserveNullAndEmptyArrays: true } },
    { $match: { full_album: null } },
  ]);

// Unwinds the album's own artist ids first, so every id is looked up on its
// own. Looking up the whole array instead only reports albums where *no*
// artist exists, and gives no way back to the ids that are missing.
export const getAlbumsWithoutArtist = () =>
  AlbumModel.aggregate<{ id: string; missingArtistId: string }>([
    { $unwind: "$artists" },
    {
      $lookup: {
        from: "artists",
        as: "full_artists",
        localField: "artists",
        foreignField: "id",
      },
    },
    { $unwind: { path: "$full_artists", preserveNullAndEmptyArrays: true } },
    { $match: { full_artists: null } },
    { $project: { id: 1, missingArtistId: "$artists" } },
  ]);
