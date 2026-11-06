import { Schema } from "mongoose";

// One song of an album's tracklist on Spotify
export interface AlbumTracklistEntry {
  id: string;
  name: string;
  disc: number;
  no: number;
  ms: number;
  // Spotify id of the song's first artist
  artist: string;
  // Looked up on Spotify when a stored song might be this one under another
  // id: null when Spotify has none, missing when not looked up
  isrc?: string | null;
}

// An album's songs, fetched once the first time its page asks for them
// (tools/albumTracklist/index.ts). Kept apart from the albums, which many answers
// include whole.
export interface AlbumTracklist {
  albumId: string;
  entries: AlbumTracklistEntry[];
  fetchedAt: Date;
}

export const AlbumTracklistSchema = new Schema<AlbumTracklist>({
  albumId: { type: String, required: true, unique: true },
  entries: { type: [Object], default: [] },
  fetchedAt: { type: Date, required: true },
});
