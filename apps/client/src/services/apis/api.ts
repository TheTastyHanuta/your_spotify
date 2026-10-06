import Axios from "axios";

import { AdminAccount } from "../redux/modules/admin/reducer";
import { ImporterState } from "../redux/modules/import/types";
import { Playlist, PlaylistContext } from "../redux/modules/playlist/types";
import { User } from "../redux/modules/user/types";
import {
  Album,
  Artist,
  DateId,
  GlobalPreferences,
  Timesplit,
  Track,
  TrackWithAlbum,
  TrackInfo,
  TrackInfoWithFullArtistAlbum,
  SpotifyMe,
  CollaborativeMode,
  UnboxPromise,
  TrackWithFullArtistAlbum,
  AlbumWithFullArtist,
} from "../types";

const axios = Axios.create({
  baseURL: (window as any as { API_ENDPOINT: string }).API_ENDPOINT,
  withCredentials: true,
});

// Add a response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      window.location.pathname = "/login";
    }
    return Promise.reject(error);
  },
);

// Adds latency to requests without having to use chrome latency
// const get = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   new Promise((res, rej) => {
//     setTimeout(() => axios.get(url, { params }).then(res).catch(rej), 1000);
//   });

// const post = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   new Promise((res, rej) => {
//     setTimeout(() => axios.post(url, params).then(res).catch(rej), 1000);
//   });

// const get = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   axios.get(`${url}${api.publicToken ? `?token=${api.publicToken}` : ''}`, { params });

// const post = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   axios.post(`${url}${api.publicToken ? `?token=${api.publicToken}` : ''}`, params);

// const put = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   axios.put(`${url}${api.publicToken ? `?token=${api.publicToken}` : ''}`, params);

// const delet = <T>(url: string, params: Record<string, any> = {}): Promise<{ data: T }> =>
//   axios.delete(`${url}${api.publicToken ? `?token=${api.publicToken}` : ''}`, params);

const get = <T>(
  url: string,
  params: Record<string, any> = {},
): Promise<{ data: T }> =>
  axios.get(url, { params: { ...params, token: api.publicToken } });

const post = <T>(
  url: string,
  params: Record<string, any> = {},
): Promise<{ data: T }> =>
  axios.post(url, params, { params: { token: api.publicToken } });

const put = <T>(
  url: string,
  params: Record<string, any> = {},
): Promise<{ data: T }> =>
  axios.put(url, params, { params: { token: api.publicToken } });

const delet = <T>(
  url: string,
  params: Record<string, any> = {},
): Promise<{ data: T }> =>
  axios.delete(url, { params: { ...params, token: api.publicToken } });

export type ArtistStatsResponse = {
  artist: Artist;
  bestPeriod: { _id: DateId; count: number; total: number }[];
  firstLast: {
    first: TrackInfo & { track: TrackWithAlbum };
    last: TrackInfo & { track: TrackWithAlbum };
  };
  mostListened: { _id: string; count: number; track: TrackWithAlbum }[];
  albumMostListened: { _id: string; count: number; album: Album }[];
  total: { count: number; primaryCount: number; featuredCount: number };
};

type Counted<Id> = { _id: Id; plays: number; durationMs: number }[];
export type TimelineCounts = {
  months: Counted<DateId>;
  // 1 is Monday
  weekdays: Counted<number>;
  hours: Counted<number>;
};
// The item's listens, and all listens between its first and last listen
export type TimelineResponse = TimelineCounts & { overall: TimelineCounts };

// Listening of a period, see the server's insights queries. Days are
// "YYYY-MM-DD" in the stats timezone.
type Counts = { plays: number; durationMs: number };
export type OverviewResponse = Counts & {
  tracks: number;
  artists: number;
  albums: number;
  // Listened to for the first time ever in the period
  newArtists: number;
  newTracks: number;
  activeDays: number;
  busiestDay?: Counts & { date: string };
  streaks: {
    longest: { days: number; start: string; end: string } | null;
    // Up to the end of the period, or today when it is not over
    current: number;
  };
  // 1 is Monday
  heatmap: (Counts & { weekday: number; hour: number })[];
};
export type CalendarResponse = (Counts & { date: string })[];
export type TasteResponse = {
  years: (Counts & {
    year: number;
    top: {
      track?: Track & { full_album: Album; full_artists: Artist[] };
      plays: number;
    };
  })[];
  ageWhenPlayed: { fresh: number; nostalgic: number };
  albumTypes: Record<string, number>;
  explicit: { explicit: number; clean: number };
  // Plays of songs < 2 min, 2-3, 3-4, 4-5, 5 min and more
  lengths: number[];
};
export type DecadesPerYearResponse = {
  year: number;
  decades: { decade: number; plays: number }[];
}[];
export type GenresResponse = {
  totalPlays: number;
  // Plays of artists with at least one genre
  coveredPlays: number;
  genres: (Counts & {
    genre: string;
    artists: Pick<Artist, "id" | "name" | "images">[];
  })[];
};

type ShortArtist = Pick<Artist, "id" | "name" | "images">;
// The fields the part of day query selects
type ShortTrack = Pick<Track, "id" | "name" | "album" | "artists"> & {
  full_album: Pick<Album, "id" | "name" | "images">;
  full_artists: Pick<Artist, "id" | "name">[];
};
export type DiscoveryOverviewResponse = {
  plays: number;
  newArtists: number;
  newTracks: number;
  newTracksByKnownArtists: number;
  // Plays of the songs new in the period
  newTrackPlays: number;
  // New songs by artists played before the period, most played first
  knownArtistTracks: { track: ShortTrack; plays: number; first: string }[];
  // Last play before the break and first play after it
  comebacks: {
    artist: ShortArtist;
    plays: number;
    lastBefore: string;
    back: string;
  }[];
  // Artists discovered in the period with at least 3 plays; the stuck ones
  // with their plays from 3 months after the first listen
  stick: {
    stuck: number;
    faded: number;
    early: number;
    artists: { artist: ShortArtist; late: number }[];
  };
};
// The best 7 days of each song, "YYYY-MM-DD"
export type OnRepeatResponse = {
  track: ShortTrack;
  plays: number;
  from: string;
  to: string;
}[];
// newCount: plays of songs first heard in the period and in that step
export type NewPlaysPerResponse = {
  _id: DateId | null;
  count: number;
  newCount: number;
}[];
// Most played of all time, not played lately. peak: "YYYY-MM", the month
// with the most plays
type ForgottenItem = {
  total: number;
  last: string;
  peak: string;
  peakPlays: number;
};
export type ForgottenResponse = {
  tracks: (ForgottenItem & { track: ShortTrack })[];
  artists: (ForgottenItem & { artist: ShortArtist })[];
};
// Months as "YYYY-MM" in the stats timezone, oldest era first. plays: the
// artist's or genre's plays during the era, total: all plays during it
type Era = { from: string; to: string; plays: number; total: number };
export type ErasResponse = {
  // First and last month with plays, null without listens
  first: string | null;
  last: string | null;
  artists: (Era & {
    artist: ShortArtist;
    // The most played song of the artist during the era
    track: Pick<Track, "id" | "name"> | null;
  })[];
  // artists: the genre's most played artists during the era
  genres: (Era & { genre: string; artists: ShortArtist[] })[];
};
export type ArtistSharesResponse = {
  plays: number;
  // The period's top 10 artists
  top: { artist: ShortArtist; plays: number }[];
  // Plays of the top 8 artists in each time step, by artist id
  steps: {
    _id: DateId | null;
    plays: number;
    artists: Record<string, number>;
  }[];
};
// Plays per release year in each time step, oldest year first
export type ReleaseYearsPerResponse = {
  _id: DateId | null;
  years: { year: number; plays: number }[];
}[];
export type PartOfDay = "morning" | "afternoon" | "evening" | "night";
// Plays or milliseconds, following the stat measurement setting
export type BestOfPartOfDayResponse<T> = {
  part: PartOfDay;
  total: number;
  items: { total: number; item: T }[];
}[];

export type DiscoveriesResponse = {
  plays: number;
  // First listen ever, and the song it was
  first: string;
  firstTrack: Pick<Track, "id" | "name"> | null;
  artist: Pick<Artist, "id" | "name" | "images">;
}[];

export type TrackStatsResponse = {
  track: Track;
  artists: Artist[];
  album: Album;
  listenedOn: { count: number; album: Album }[];
  bestPeriod: { _id: DateId; count: number; total: number }[];
  firstLast: { first: TrackInfo; last: TrackInfo };
  recentHistory: TrackInfo[];
  total: { count: number };
};

export type AlbumStatsResponse = {
  album: Album;
  artists: Artist[];
  tracks: { track: Track; count: number }[];
  bestPeriod: { _id: DateId; count: number; total: number }[];
  firstLast: {
    first: TrackInfo & { track: TrackWithAlbum };
    last: TrackInfo & { track: TrackWithAlbum };
  };
  recentHistory: TrackInfo[];
  total: { count: number };
};

export const api = {
  publicToken: null as string | null,

  version: () => get<{ update: boolean; version: string }>("/version"),
  spotify: () => get("/oauth/spotify"),
  logout: () => axios.post("/logout"),

  me: () => get<{ status: true; user: User } | { status: false }>("/me"),
  sme: () => get<SpotifyMe>("/oauth/spotify/me"),
  globalPreferences: () => get<GlobalPreferences>("/global/preferences"),
  rename: (newName: string) => put("/rename", { newName }),
  getAccounts: () => get<AdminAccount[]>("/accounts"),
  setAdmin: (id: string, status: boolean) => put(`/admin/${id}`, { status }),
  deleteUser: (id: string) => delet(`/account/${id}`),
  setGlobalPreferences: (preferences: Partial<GlobalPreferences>) =>
    post<GlobalPreferences>("/global/preferences", preferences),
  play: (id: string) => axios.post("/spotify/play", { id }),
  getTracks: (start: Date, end: Date, number: number, offset: number) =>
    get<TrackInfoWithFullArtistAlbum[]>("/spotify/gethistory", {
      number,
      offset,
      start,
      end,
    }),
  mostListened: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<{ tracks: TrackWithAlbum[]; counts: number[] }[]>(
      "/spotify/most_listened",
      { start, end, timeSplit },
    ),
  listened_to: (start: Date, end: Date) =>
    get("/spotify/listened_to", { start, end }),
  songsPer: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<
      {
        _id: DateId | null;
        // Plays
        count: number;
        differents: number;
        differentArtists: number;
      }[]
    >("/spotify/songs_per", { start, end, timeSplit }),
  timePer: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<{ count: number; _id: DateId | null }[]>("/spotify/time_per", {
      start,
      end,
      timeSplit,
    }),
  bestArtistsPer: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<{ artists: Artist[]; counts: number[]; _id: DateId | null }[]>(
      "/spotify/best_artists_per",
      { start, end, timeSplit },
    ),
  setSetting: (settingName: keyof User["settings"], settingValue: any) =>
    axios.post("/settings", { [settingName]: settingValue }),
  timePerHourOfDay: (start: Date, end: Date) =>
    get<
      {
        // _id is the hour of the day
        _id: number;
        count: number;
      }[]
    >("/spotify/time_per_hour_of_day", { start, end }),
  getAlbums: (ids: string[]) => get<Album[]>(`/album/${ids.join(",")}`),
  getAlbumStats: (id: string) =>
    get<AlbumStatsResponse | { code: "NEVER_LISTENED" }>(`/album/${id}/stats`),
  getAlbumRank: (id: string) =>
    get<{
      index: number;
      isMax: boolean;
      isMin: boolean;
      results: { id: string; count: number }[];
    }>(`/album/${id}/rank`),
  getArtists: (ids: string[]) => get<Artist[]>(`/artist/${ids.join(",")}`),
  getOverview: (start: Date, end: Date) =>
    get<OverviewResponse>("/spotify/overview", { start, end }),
  getCalendar: (start: Date, end: Date) =>
    get<CalendarResponse>("/spotify/calendar", { start, end }),
  getTaste: (start: Date, end: Date) =>
    get<TasteResponse>("/spotify/taste", { start, end }),
  getArtistShares: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<ArtistSharesResponse>("/spotify/taste/artist_shares", {
      start,
      end,
      timeSplit,
    }),
  getReleaseYearsPer: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<ReleaseYearsPerResponse>("/spotify/taste/release_years_per", {
      start,
      end,
      timeSplit,
    }),
  getBestOfPartOfDay: <T extends "artists" | "tracks">(
    start: Date,
    end: Date,
    type: T,
  ) =>
    get<
      BestOfPartOfDayResponse<T extends "artists" ? ShortArtist : ShortTrack>
    >("/spotify/top/part-of-day", { start, end, type }),
  getDecadesPerYear: () =>
    get<DecadesPerYearResponse>("/spotify/taste/decades"),
  getGenres: (start: Date, end: Date, nb: number) =>
    get<GenresResponse>("/spotify/genres", { start, end, nb }),
  getDiscoveries: (start: Date, end: Date, nb: number) =>
    get<DiscoveriesResponse>("/spotify/discoveries", { start, end, nb }),
  getDiscoveryOverview: (start: Date, end: Date) =>
    get<DiscoveryOverviewResponse>("/spotify/discoveries/overview", {
      start,
      end,
    }),
  getOnRepeat: (start: Date, end: Date) =>
    get<OnRepeatResponse>("/spotify/discoveries/on-repeat", { start, end }),
  getNewPlaysPer: (start: Date, end: Date, timeSplit: Timesplit) =>
    get<NewPlaysPerResponse>("/spotify/discoveries/per", {
      start,
      end,
      timeSplit,
    }),
  getForgotten: (days: number) =>
    get<ForgottenResponse>("/spotify/story/forgotten", { days }),
  getEras: () => get<ErasResponse>("/spotify/story/eras"),
  getTimeline: (type: "artist" | "album" | "track", id: string) =>
    get<TimelineResponse | { code: "NEVER_LISTENED" }>("/spotify/timeline", {
      type,
      id,
    }),
  getArtistStats: (id: string) =>
    get<ArtistStatsResponse | { code: "NEVER_LISTENED" }>(
      `/artist/${id}/stats`,
    ),
  getArtistRank: (id: string) =>
    get<{
      index: number;
      isMax: boolean;
      isMin: boolean;
      results: { id: string; count: number }[];
    }>(`/artist/${id}/rank`),
  search: (str: string) =>
    get<{
      artists: Artist[];
      tracks: TrackWithFullArtistAlbum[];
      albums: AlbumWithFullArtist[];
    }>(`/search/${encodeURIComponent(str)}`),
  getBestSongs: (start: Date, end: Date, nb: number, offset: number) =>
    get<
      {
        count: number;
        duration_ms: number;
        total_count: number;
        total_duration_ms: number;
        album: Album;
        artist: Artist;
        track: Track;
        track_artists: Artist[];
      }[]
    >("/spotify/top/songs", { start, end, nb, offset }),
  getBestArtists: (start: Date, end: Date, nb: number, offset: number) =>
    get<
      {
        count: number;
        duration_ms: number;
        total_count: number;
        total_duration_ms: number;
        artist: Artist;
        differents: number;
      }[]
    >("/spotify/top/artists", { start, end, nb, offset }),
  getBestAlbums: (start: Date, end: Date, nb: number, offset: number) =>
    get<
      {
        count: number;
        duration_ms: number;
        total_count: number;
        total_duration_ms: number;
        artist: Artist;
        album: Album;
        album_artists: Artist[];
      }[]
    >("/spotify/top/albums", { start, end, nb, offset }),
  getImports: () => get<ImporterState[]>("/imports"),
  doImportPrivacy: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("imports", file);
    });
    return axios.post("/import/privacy", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  doImportFullPrivacy: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("imports", file);
    });
    return axios.post("/import/full-privacy", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  retryImport: (existingStateId: string) =>
    post("/import/retry", { existingStateId }),
  cleanupImport: (id: string) => delet(`/import/clean/${id}`),
  collaborativeBestSongs: (
    ids: string[],
    start: Date,
    end: Date,
    mode: CollaborativeMode,
  ) =>
    get<
      ({ track: Track; album: Album; artist: Artist } & Record<
        string,
        number
      >)[]
    >("/spotify/collaborative/top/songs", { otherIds: ids, start, end, mode }),
  collaborativeBestAlbums: (
    ids: string[],
    start: Date,
    end: Date,
    mode: CollaborativeMode,
  ) =>
    get<({ album: Album; artist: Artist } & Record<string, number>)[]>(
      "/spotify/collaborative/top/albums",
      { otherIds: ids, start, end, mode },
    ),
  collaborativeBestArtists: (
    ids: string[],
    start: Date,
    end: Date,
    mode: CollaborativeMode,
  ) =>
    get<({ artist: Artist } & Record<string, number>)[]>(
      "/spotify/collaborative/top/artists",
      { otherIds: ids, start, end, mode },
    ),
  generatePublicToken: () => post<string>("/generate-public-token"),
  deletePublicToken: () => post<string>("/delete-public-token"),
  getPlaylists: () => get<Playlist[]>("/spotify/playlists"),
  addToPlaylist: (
    id: string | undefined,
    name: string | undefined,
    context: PlaylistContext,
  ) => post("/spotify/playlist/create", { playlistId: id, name, ...context }),
  getTrackDetails: (ids: string[]) => get<Track[]>(`/track/${ids.join(",")}`),
  getTrackStats: (id: string) =>
    get<TrackStatsResponse | { code: "NEVER_LISTENED" }>(`/track/${id}/stats`),
  getTrackRank: (id: string) =>
    get<{
      index: number;
      isMax: boolean;
      isMin: boolean;
      results: { id: string; count: number }[];
    }>(`/track/${id}/rank`),
  blacklistArtist: (artistId: string) => post(`/artist/blacklist/${artistId}`),
  unblacklistArtist: (artistId: string) =>
    post(`/artist/unblacklist/${artistId}`),
  getLongestSessions: (start: Date, end: Date) =>
    get<
      {
        sessionLength: number;
        full_tracks: Record<string, Track>;
        full_albums: Record<string, Album>;
        distanceToLast: { distance: { subtract: number; info: TrackInfo }[] };
      }[]
    >("/spotify/top/sessions", { start, end }),
};

export const DEFAULT_ITEMS_TO_LOAD = 20;

type ApiSignature = typeof api;

export type RecordAsTuples<F, K extends keyof F = keyof F> = K extends K
  ? [K, F[K]]
  : never;
type Signatures = RecordAsTuples<ApiSignature>;
type TupleToUnbox<T extends [string, any]> = T extends [
  string,
  (...args: any[]) => Promise<{ data: any }>,
]
  ? [T[0], UnboxPromise<ReturnType<T[1]>>]
  : never;

type NamesAndReturns = TupleToUnbox<Signatures>;
export type ApiData<T extends NamesAndReturns[0]> = Extract<
  NamesAndReturns,
  [T, any]
>[1]["data"];
