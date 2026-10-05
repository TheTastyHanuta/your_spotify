import { Schema } from "mongoose";

import { SpotifyImage } from "./types";

export interface Artist {
  external_urls: any;
  genres: string[];
  href: string;
  id: string;
  images: SpotifyImage[];
  name: string;
  type: string;
  uri: string;
  // From MusicBrainz (tools/genres.ts), kept apart from Spotify's genres
  mbGenres?: string[];
  mbGenresFetchedAt?: Date;
}
export type SpotifyArtist = Artist;

export const ArtistSchema = new Schema<Artist>(
  {
    external_urls: Object,
    genres: [String],
    href: String,
    id: { type: String, unique: true },
    images: [Object],
    name: String,
    type: String,
    uri: String,
    mbGenres: { type: [String], default: undefined },
    mbGenresFetchedAt: Date,
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
