import { readFile, unlink } from "fs/promises";

import { Types } from "mongoose";
import { z } from "zod";

import {
  addTrackIdsToUser,
  getCloseTrackId,
  getUserFromField,
  storeFirstListenedAtIfLess,
} from "../../database";
import { ArtistModel, InfosModel, TrackModel } from "../../database/Models";
import { forgetHooks } from "../../database/queries/hooked";
import {
  setImporterStateCurrent,
  setImporterStateLookups,
} from "../../database/queries/importer";
import {
  getIsrcLookups,
  storeIsrcLookup,
} from "../../database/queries/isrcMerge";
import { Infos } from "../../database/schemas/info";
import {
  RecentlyPlayedTrack,
  SpotifyTrack,
} from "../../database/schemas/track";
import { User } from "../../database/schemas/user";
import {
  getReusableStoredTracks,
  getTracksAlbumsArtists,
  storeTrackAlbumArtist,
} from "../../spotify/dbTools";
import { SpotifyAPI } from "../apis/spotifyApi";
import { artistBlacklistMark } from "../blacklist";
import { logger } from "../logger";
import { minOfArray, retryPromise } from "../misc";
import { Unpack } from "../types";
import { getFromCacheString, setToCacheString } from "./cache";
import { isCloseListen } from "./duplicates";
import {
  DUPLICATE_MS,
  ExportPlay,
  LATE_MS,
  MIN_PLAY_MS,
  offlineStoppedAt,
  planImport,
  playsNearListens,
  StoredListen,
  StoredTrack,
} from "./matching";
import {
  FullPrivacyImporterState,
  HistoryImporter,
  stopIfPauseRequested,
} from "./types";

const fullPrivacyFileSchema = z.array(
  z.object({
    ts: z.string(),
    ms_played: z.number(),
    spotify_track_uri: z.string().nullable(),
    master_metadata_track_name: z.string().nullable(),
    master_metadata_album_artist_name: z.string().nullable(),
    reason_end: z.string().nullish(),
    offline: z.boolean().nullish(),
    offline_timestamp: z.number().nullish(),
  }),
);

export type FullPrivacyItem = Unpack<z.infer<typeof fullPrivacyFileSchema>>;

// How many of the listens the export doesn't have the log lists
const MAX_LISTED = 100;

// The oldest of the stored listens the export doesn't have, for the log
export const listedUnmatched = (unmatched: StoredListen[]) =>
  unmatched.toSorted((a, b) => a.time - b.time).slice(0, MAX_LISTED);

// The log lines for stored listens the export doesn't have. Not removed: some
// are real plays Spotify left out of the export.
export const unmatchedText = (
  shown: StoredListen[],
  total: number,
  names: Map<string, string>,
) =>
  [
    "Import: stored listens the export doesn't have (times in UTC). Not all of them are wrong: Spotify leaves some plays out of the export, and listens from the time of files you didn't import are listed too. Remove wrong ones from your history.",
    ...shown.map(
      (listen) =>
        `  ${new Date(listen.time).toISOString().slice(0, 19).replace("T", " ")}  ${names.get(listen.trackId) ?? listen.trackId}`,
    ),
    ...(total > shown.length ? [`  … and ${total - shown.length} more.`] : []),
  ].join("\n");

export class FullPrivacyImporter implements HistoryImporter<"full-privacy"> {
  private id: string;

  private userId: string;

  private elements: FullPrivacyItem[] | null;

  private currentItem: number;

  private spotifyApi: SpotifyAPI;

  // Index of the oldest element waiting in idsToSearch, those are not stored
  // yet so a retried import has to start from there.
  private oldestPendingItem: number | null;

  // Indexes of the plays no stored listen stands for, the only ones imported
  private toImport: Set<number>;

  constructor(user: User) {
    this.id = "";
    this.userId = user._id.toString();
    this.elements = null;
    this.currentItem = 0;
    this.spotifyApi = new SpotifyAPI(this.userId);
    this.oldestPendingItem = null;
    this.toImport = new Set();
  }

  static idFromSpotifyURI = (uri: string) => uri.split(":")[2];

  // When the play stopped, see offlineStoppedAt. Only offline rows: those
  // are the ones the export gives the sync time for.
  static stoppedAt = (content: FullPrivacyItem) =>
    content.offline
      ? offlineStoppedAt(
          Date.parse(content.ts),
          content.offline_timestamp,
          content.ms_played,
        )
      : undefined;

  static playedAt = (content: FullPrivacyItem) => {
    const stopped = FullPrivacyImporter.stoppedAt(content);
    return stopped === undefined ? content.ts : new Date(stopped).toISOString();
  };

  search = async (spotifyIds: string[]) => {
    const tracks: (SpotifyTrack | undefined)[] = [];
    // One id at a time, so a retry does not fetch the whole batch again
    for (const id of spotifyIds) {
      tracks.push(
        await retryPromise(
          () => this.spotifyApi.getTrack(id),
          10,
          30,
          "Import: Spotify track lookup",
        ),
      );
    }
    return tracks;
  };

  storeItems = async (userId: string, items: RecentlyPlayedTrack[]) => {
    const { tracks, albums, artists, tracksBySpotifyId } = await retryPromise(
      () =>
        getTracksAlbumsArtists(
          userId,
          items.map((it) => it.track),
        ),
      10,
      30,
      "Import: preparing track metadata",
    );
    await storeTrackAlbumArtist({ tracks, albums, artists });
    // Read for every batch: an import can run for days, and the poller marks
    // listens of blacklisted artists the same way
    const user = await getUserFromField(
      "_id",
      new Types.ObjectId(userId),
      false,
    );
    const blacklistedArtists = user?.settings.blacklistedArtists ?? [];
    const finalInfos: Omit<Infos, "owner">[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      const track = tracksBySpotifyId.get(item.track.id);
      if (!track) {
        continue;
      }
      const date = new Date(item.played_at);
      // A play can end next to a listen of the same track: one the plan
      // didn't move, or a track id it didn't know that turns out to be the
      // same track. The startup cleanup would delete one of the two anyway.
      const duplicate = await getCloseTrackId(
        this.userId.toString(),
        [track.id, item.track.id],
        date,
        DUPLICATE_MS / 1000,
      );
      if (
        duplicate.length > 0 ||
        isCloseListen(finalInfos, track.id, date, DUPLICATE_MS / 1000)
      ) {
        logger.debug(
          `${item.track.name} - ${item.track.artists[0]?.name} was duplicate`,
        );
        continue;
      }
      const [primaryArtist] = item.track.artists;
      if (!primaryArtist) {
        continue;
      }
      finalInfos.push({
        played_at: date,
        id: track.id,
        primaryArtistId: primaryArtist.id,
        albumId: item.track.album.id,
        artistIds: item.track.artists.map((e) => e.id),
        durationMs: item.track.duration_ms,
        ...artistBlacklistMark(blacklistedArtists, primaryArtist.id),
      });
    }
    // Recorded before the listens: once those are stored, a retry skips them
    // as duplicates and would never record their date.
    const min = minOfArray(finalInfos, (info) => info.played_at.getTime());
    if (min) {
      const minInfo = finalInfos[min.minIndex];
      if (minInfo) {
        await storeFirstListenedAtIfLess(this.userId, minInfo.played_at);
      }
    }
    // Save the progress only once the listens are stored. A retry pairs the
    // listens stored before with their plays and doesn't import them again.
    await addTrackIdsToUser(this.userId.toString(), finalInfos);
    await setImporterStateCurrent(
      this.id,
      this.oldestPendingItem ?? this.currentItem + 1,
    );
  };

  initWithJSONContent = async (content: any[]) => {
    const value = fullPrivacyFileSchema.safeParse(content);
    if (value.success) {
      this.elements = value.data;
      return content;
    }
    logger.error(
      "If you submitted the right files and this error comes up, please open an issue with the following logs at https://github.com/TheTastyHanuta/your_spotify/issues",
      JSON.stringify(value.error.issues, null, " "),
    );
    return null;
  };

  initWithFiles = async (filePaths: string[]) => {
    const files = await Promise.all(filePaths.map((f) => readFile(f)));
    const filesContent = files.map((f) => JSON.parse(f.toString()));

    const totalContent = filesContent.reduce<FullPrivacyItem[]>((acc, curr) => {
      acc.push(...curr);
      return acc;
    }, []);

    if (!(await this.initWithJSONContent(totalContent))) {
      return false;
    }

    return true;
  };

  init = async (
    existingState: FullPrivacyImporterState | null,
    filePaths: string[],
  ) => {
    try {
      this.currentItem = existingState?.current ?? 0;
      const success = await this.initWithFiles(filePaths);
      if (success) {
        return { total: this.elements!.length };
      }
    } catch (e) {
      logger.error(e);
    }
    return null;
  };

  checkIdsToSearch = async (
    idsToSearch: Record<string, string[]>,
    items: RecentlyPlayedTrack[],
    force = false,
  ) => {
    const ids = Object.keys(idsToSearch);
    if (ids.length < 45 && !force) {
      return idsToSearch;
    }
    // Tracks stored before, by the polling loop or a run that got rate
    // limited, are not requested again.
    const stored = await retryPromise(
      () => getReusableStoredTracks(ids),
      10,
      30,
      "Import: stored track lookup",
    );
    const toSearch = ids.filter((id) => !stored.has(id));
    const searchedItems = await this.search(toSearch);
    const searchedById = new Map(
      toSearch.map((id, index) => [id, searchedItems[index]]),
    );
    for (const id of ids) {
      const searchedItem = stored.get(id) ?? searchedById.get(id);
      if (searchedItem === undefined) {
        setToCacheString(this.userId.toString(), id, { exists: false });
        continue;
      }
      // Keyed by the requested id, Spotify can answer with another id for
      // relinked tracks and the file keeps referring to the requested one.
      const playedAt = idsToSearch[id];
      if (!playedAt) {
        continue;
      }
      setToCacheString(this.userId.toString(), id, {
        exists: true,
        track: searchedItem,
      });
      playedAt.forEach((pa) => {
        items.push({ track: searchedItem, played_at: pa });
      });
      logger.debug(
        stored.has(id)
          ? `Adding ${searchedItem.name} from the database`
          : `Adding ${searchedItem.name} - ${searchedItem.artists[0]?.name} from data`,
      );
    }
    this.oldestPendingItem = null;
    idsToSearch = {};
    return idsToSearch;
  };

  // Pairs the export's plays with the stored listens, moves listens Spotify
  // stamped late to the export's time and keeps the plays to import. Runs at
  // every start: listens an earlier run stored pair with their own plays.
  // Asks Spotify first for the tracks the database doesn't know, so they pair
  // by ISRC; the answers are cached for the import.
  plan = async (elements: FullPrivacyItem[]) => {
    const plays: ExportPlay[] = [];
    elements.forEach((content, index) => {
      const trackId =
        content.spotify_track_uri &&
        FullPrivacyImporter.idFromSpotifyURI(content.spotify_track_uri);
      const time = Date.parse(content.ts);
      if (!trackId || Number.isNaN(time)) {
        return;
      }
      plays.push({
        index,
        time,
        trackId,
        msPlayed: content.ms_played,
        reasonEnd: content.reason_end,
        stoppedAt: FullPrivacyImporter.stoppedAt(content),
      });
    });
    if (plays.length === 0) {
      this.toImport = new Set();
      return;
    }
    let first = Number.POSITIVE_INFINITY;
    let last = Number.NEGATIVE_INFINITY;
    for (const play of plays) {
      first = Math.min(first, play.stoppedAt ?? play.time);
      last = Math.max(last, play.time);
    }
    const owner = new Types.ObjectId(this.userId);
    // Removed listens count as stored, so they are not imported again
    const listens = (
      await InfosModel.find(
        {
          owner,
          played_at: {
            // Spotify stamps some plays up to LATE_MS early or late
            $gte: new Date(first - LATE_MS),
            $lte: new Date(last + LATE_MS),
          },
        },
        { id: 1, played_at: 1 },
      ).lean()
    ).map((listen) => ({
      _id: listen._id.toString(),
      time: listen.played_at.getTime(),
      trackId: listen.id,
    }));
    const tracks = await this.storedTracks([
      ...new Set([
        ...listens.map((listen) => listen.trackId),
        ...plays.map((play) => play.trackId),
      ]),
    ]);
    // The ISRC merge stores the ISRCs it looked up only when it is applied
    const withoutIsrc = [...tracks]
      .filter(([, track]) => !track.isrc && !track.mergedInto)
      .map(([id]) => id);
    for (const [id, isrc] of await getIsrcLookups(withoutIsrc)) {
      if (isrc) {
        tracks.get(id)!.isrc = isrc;
      }
    }
    await this.addUnknownTracks(playsNearListens(plays, listens), tracks);
    const { matched, moves, toImport, unmatched } = planImport(
      plays,
      listens,
      tracks,
      await this.newestPolled(plays),
    );
    if (moves.length > 0) {
      // First: a retry finds the moves done and would not record it
      await storeFirstListenedAtIfLess(
        this.userId,
        new Date(moves.reduce((min, move) => Math.min(min, move.to), Infinity)),
      );
      await InfosModel.bulkWrite(
        moves.map((move) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(move._id), owner },
            update: { $set: { played_at: new Date(move.to) } },
          },
        })),
      );
      forgetHooks(this.userId);
    }
    logger.info(
      `Import: ${matched} plays already stored, ${moves.length} of them moved to the export's time; ${toImport.size} plays to import; ${unmatched.length} stored listens from the export's time span are not in it`,
    );
    if (unmatched.length > 0) {
      const shown = listedUnmatched(unmatched);
      // Only for the log, so a failed lookup must not fail the import
      const names = await this.songNames(
        shown.map((listen) => listen.trackId),
      ).catch((e) => {
        logger.warn("Import: could not read the song names for the log", e);
        return new Map<string, string>();
      });
      logger.info(unmatchedText(shown, unmatched.length, names));
    }
    this.toImport = toImport;
  };

  // Spotify's recently played list, which the poller reads 50 at a time, still
  // holds the newest listens; moved, the poller would store them again. Plays
  // an earlier run imported from this export (at its exact times) are not in
  // that list, so they don't count.
  newestPolled = async (plays: ExportPlay[]) => {
    const exportTimes = new Set(
      plays.flatMap((play) => [play.time, play.stoppedAt ?? play.time]),
    );
    const ids = new Set<string>();
    const cursor = InfosModel.find(
      { owner: new Types.ObjectId(this.userId) },
      { played_at: 1 },
    )
      .sort({ played_at: -1 })
      .lean()
      .cursor();
    try {
      // Mongoose's cursor doesn't close itself when the loop returns early
      for await (const listen of cursor) {
        if (!exportTimes.has(listen.played_at.getTime())) {
          ids.add(listen._id.toString());
          if (ids.size === 50) {
            break;
          }
        }
      }
    } finally {
      await cursor.close();
    }
    return ids;
  };

  // "Title – first artist" of the given tracks
  songNames = async (ids: string[]) => {
    const tracks = await TrackModel.find(
      { id: { $in: ids } },
      { id: 1, name: 1, artists: 1 },
    ).lean();
    const artists = new Map(
      (
        await ArtistModel.find(
          { id: { $in: tracks.flatMap((track) => track.artists.slice(0, 1)) } },
          { id: 1, name: 1 },
        ).lean()
      ).map((artist) => [artist.id, artist.name]),
    );
    return new Map(
      tracks.map((track) => {
        const artist = artists.get(track.artists[0] ?? "");
        return [track.id, artist ? `${track.name} – ${artist}` : track.name];
      }),
    );
  };

  // ISRC and merge target of the given tracks and of the tracks they were
  // merged into
  storedTracks = async (ids: string[]) => {
    const tracks = new Map<string, StoredTrack>();
    let toFetch = ids;
    while (toFetch.length > 0) {
      const found = await TrackModel.find(
        { id: { $in: toFetch } },
        { id: 1, isrc: 1, mergedInto: 1 },
      ).lean();
      for (const track of found) {
        tracks.set(track.id, {
          isrc: track.isrc ?? undefined,
          mergedInto: track.mergedInto ?? undefined,
        });
      }
      toFetch = [
        ...new Set(
          found.flatMap((track) =>
            track.mergedInto && !tracks.has(track.mergedInto)
              ? [track.mergedInto]
              : [],
          ),
        ),
      ];
    }
    return tracks;
  };

  // Adds the ISRC Spotify gives for the plays' tracks not stored yet. Only
  // plays of 30 s or more: shorter ones are never imported, and skipped songs
  // would cost most of the requests. The import looks up the others when it
  // stores their plays. Answers are stored with the ISRC merge's
  // lookups, so a paused or retried import doesn't ask again.
  addUnknownTracks = async (
    plays: ExportPlay[],
    tracks: Map<string, StoredTrack>,
  ) => {
    const ids = [
      ...new Set(
        plays
          .filter((play) => play.msPlayed >= MIN_PLAY_MS)
          .map((play) => play.trackId)
          .filter((id) => !tracks.has(id)),
      ),
    ];
    const isrcs = await getIsrcLookups(ids);
    const toSearch = ids.filter((id) => !isrcs.has(id));
    if (toSearch.length > 0) {
      logger.info(
        `Import: looking up ${toSearch.length} tracks that aren't stored yet`,
      );
    }
    for (const [index, id] of toSearch.entries()) {
      stopIfPauseRequested();
      await setImporterStateLookups(this.id, {
        done: index,
        total: toSearch.length,
      });
      if (index > 0 && index % 25 === 0) {
        logger.info(`Import: looked up ${index} of ${toSearch.length} tracks`);
      }
      const [track] = await this.search([id]);
      // Kept for the import of the track's plays
      setToCacheString(
        this.userId.toString(),
        id,
        track ? { exists: true, track } : { exists: false },
      );
      const isrc = track?.external_ids?.isrc || null;
      await storeIsrcLookup(id, isrc);
      isrcs.set(id, isrc);
    }
    if (toSearch.length > 0) {
      await setImporterStateLookups(this.id);
    }
    for (const [id, isrc] of isrcs) {
      tracks.set(id, { isrc: isrc ?? undefined });
    }
  };

  run = async (id: string) => {
    this.id = id;
    let items: RecentlyPlayedTrack[] = [];
    // Id of song to played_at
    let idsToSearch: Record<string, string[]> = {};
    if (!this.elements) {
      return false;
    }
    await this.plan(this.elements);
    for (let i = this.currentItem; i < this.elements.length; i += 1) {
      stopIfPauseRequested();
      this.currentItem = i;
      if (i % 1000 === 0) {
        logger.info(`Importing... (${i}/${this.elements.length})`);
      }
      const content = this.elements[i]!;
      // Already stored, shorter than 30 s or without a track
      if (!this.toImport.has(i) || !content.spotify_track_uri) {
        continue;
      }
      const spotifyId = FullPrivacyImporter.idFromSpotifyURI(
        content.spotify_track_uri,
      );
      if (!spotifyId) {
        logger.warn(
          `Could not get spotify id from uri: ${content.spotify_track_uri}`,
        );
        continue;
      }
      const item = getFromCacheString(this.userId.toString(), spotifyId);
      if (!item) {
        const arrayOfPlayedAt = idsToSearch[spotifyId] ?? [];
        arrayOfPlayedAt.push(FullPrivacyImporter.playedAt(content));
        idsToSearch[spotifyId] = arrayOfPlayedAt;
        this.oldestPendingItem ??= i;
        idsToSearch = await this.checkIdsToSearch(idsToSearch, items);
      } else if (item.exists) {
        items.push({
          track: item.track,
          played_at: FullPrivacyImporter.playedAt(content),
        });
      }
      if (items.length >= 20) {
        await this.storeItems(this.userId, items);
        items = [];
      }
    }
    await this.checkIdsToSearch(idsToSearch, items, true);
    if (items.length > 0) {
      await this.storeItems(this.userId, items);
      items = [];
    }
    return true;
  };

  cleanup = async (filePaths: string[]) => {
    await Promise.all(filePaths.map((f) => unlink(f)));
  };
}
