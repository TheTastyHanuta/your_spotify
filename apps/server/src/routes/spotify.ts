import { Router } from "express";
import { z } from "zod";

import {
  getTrackBySpotifyId,
  getSongs,
  getSongsPer,
  getMostListenedSongs,
  getTimePer,
  getDayRepartition,
  getBestArtistsPer,
  getLongestListeningSession,
  getBest,
  ItemType,
  getMostListenedSongOfArtist,
  getArtists,
} from "../database";
import {
  CollaborativeMode,
  getCollaborativeBestAlbums,
  getCollaborativeBestArtists,
  getCollaborativeBestSongs,
} from "../database/queries/collaborative";
import {
  getDiscoveryOverview,
  getNewPlaysPer,
  getOnRepeat,
  getSongDiscoveries,
} from "../database/queries/discoveries";
import {
  getCalendar,
  getDecadesPerYear,
  getDiscoveries,
  getGenres,
  getArtistShares,
  getBestOfPartOfDay,
  getOverview,
  getReleaseYearsPer,
  getTaste,
  getTimeline,
} from "../database/queries/insights";
import {
  getEras,
  getForgotten,
  getLoyal,
  getOnThisDay,
} from "../database/queries/story";
import { DateFormatter, intervalToDisplay } from "../tools/date";
import { logger } from "../tools/logger";
import {
  affinityAllowed,
  checkAffinityAllowed,
  isLoggedOrGuest,
  logged,
  validate,
  withHttpClient,
} from "../tools/middleware";
import { uniq } from "../tools/misc";
import { SpotifyRequest, LoggedRequest, Timesplit } from "../tools/types";
import { toDate, toNumber } from "../tools/zod";

export const router = Router();

const playSchema = z.object({ id: z.string() });

router.post("/play", logged, withHttpClient, async (req, res) => {
  const { client } = req as SpotifyRequest;
  const { id } = validate(req.body, playSchema);

  try {
    const track = await getTrackBySpotifyId(id);

    if (!track) {
      res.status(400).end();
      return;
    }
    await client.playTrack(track.uri);
    res.status(200).end();
  } catch (e) {
    if (e.response) {
      logger.error(e.response.data);
      res.status(400).send(e.response.data.error);
      return;
    }
    throw e;
  }
});

const gethistorySchema = z.object({
  number: z.preprocess(toNumber, z.number().max(20)),
  offset: z.preprocess(toNumber, z.number()),
  start: z.preprocess(toDate, z.date().optional()),
  end: z.preprocess(toDate, z.date().optional()),
});

router.get("/gethistory", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { number, offset, start, end } = validate(req.query, gethistorySchema);

  const tracks = await getSongs(
    user._id.toString(),
    offset,
    number,
    start && end ? { start, end } : undefined,
  );
  res.status(200).send(tracks);
});

const interval = z.object({
  start: z.preprocess(toDate, z.date()),
  end: z.preprocess(
    toDate,
    z.date().default(() => new Date()),
  ),
});

// How many rows a list returns; the "See all" pages ask for up to 500
const nbRows = (fallback: number, max = 500) =>
  z.preprocess(toNumber, z.number().int().min(1).max(max).default(fallback));

const intervalPerSchema = z.object({
  start: z.preprocess(toDate, z.date()),
  end: z.preprocess(
    toDate,
    z.date().default(() => new Date()),
  ),
  timeSplit: z.nativeEnum(Timesplit).default(Timesplit.day),
});

router.get("/listened_to", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end } = validate(req.query, interval);

  const result = await getSongsPer(user, start, end);
  if (result.length > 0) {
    res.status(200).send({ count: result[0].count });
    return;
  }
  res.status(200).send({ count: 0 });
});

router.get("/most_listened", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);

  const result = await getMostListenedSongs(user, start, end, timeSplit);
  res.status(200).send(result);
});

router.get("/songs_per", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);

  const result = await getSongsPer(user, start, end, timeSplit);
  res.status(200).send(result);
});

router.get("/time_per", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);

  const result = await getTimePer(user, start, end, timeSplit);
  res.status(200).send(result);
});

router.get("/time_per_hour_of_day", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end } = validate(req.query, interval);

  const result = await getDayRepartition(user, start, end);
  res.status(200).send(result);
});

router.get("/best_artists_per", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);

  const result = await getBestArtistsPer(user, start, end, timeSplit);
  res.status(200).send(result);
});

const intervalPerSchemaNbOffset = z.object({
  start: z.preprocess(toDate, z.date()),
  end: z.preprocess(
    toDate,
    z.date().default(() => new Date()),
  ),
  nb: z.preprocess(toNumber, z.number().min(1).max(30)),
  offset: z.preprocess(toNumber, z.number().min(0).default(0)),
});

router.get("/top/songs", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb, offset } = validate(
    req.query,
    intervalPerSchemaNbOffset,
  );

  const result = await getBest(ItemType.track, user, start, end, nb, offset);
  res.status(200).send(result);
});

router.get("/top/artists", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb, offset } = validate(
    req.query,
    intervalPerSchemaNbOffset,
  );

  const result = await getBest(ItemType.artist, user, start, end, nb, offset);
  res.status(200).send(result);
});

router.get("/top/albums", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb, offset } = validate(
    req.query,
    intervalPerSchemaNbOffset,
  );

  const result = await getBest(ItemType.album, user, start, end, nb, offset);
  res.status(200).send(result);
});

const collaborativeSchema = intervalPerSchema.merge(
  z.object({
    otherIds: z.array(z.string()).min(1),
    mode: z.nativeEnum(CollaborativeMode),
  }),
);

export function normalizeOtherIdsQuery(query: any) {
  if (query["otherIds[]"]) {
    query.otherIds = Array.isArray(query["otherIds[]"])
      ? query["otherIds[]"]
      : [query["otherIds[]"]];
    delete query["otherIds[]"];
  }
  return query;
}

router.get(
  "/collaborative/top/songs",
  logged,
  affinityAllowed,
  async (req, res) => {
    const normalizedQuery = normalizeOtherIdsQuery(req.query);
    const { user } = req as LoggedRequest;
    const { start, end, otherIds, mode } = validate(
      normalizedQuery,
      collaborativeSchema,
    );
    const result = await getCollaborativeBestSongs(
      [user._id.toString(), ...otherIds.filter((e) => e.length > 0)],
      start,
      end,
      mode,
      50,
    );
    res.status(200).send(result);
  },
);

router.get(
  "/collaborative/top/albums",
  logged,
  affinityAllowed,
  async (req, res) => {
    const normalizedQuery = normalizeOtherIdsQuery(req.query);
    const { user } = req as LoggedRequest;
    const { start, end, otherIds, mode } = validate(
      normalizedQuery,
      collaborativeSchema,
    );

    const result = await getCollaborativeBestAlbums(
      [user._id.toString(), ...otherIds],
      start,
      end,
      mode,
    );
    res.status(200).send(result);
  },
);

router.get(
  "/collaborative/top/artists",
  logged,
  affinityAllowed,
  async (req, res) => {
    const normalizedQuery = normalizeOtherIdsQuery(req.query);
    const { user } = req as LoggedRequest;
    const { start, end, otherIds, mode } = validate(
      normalizedQuery,
      collaborativeSchema,
    );

    const result = await getCollaborativeBestArtists(
      [user._id.toString(), ...otherIds],
      start,
      end,
      mode,
    );
    res.status(200).send(result);
  },
);

// Each session carries all its plays, so fewer of them
const sessionsSchema = interval.extend({ nb: nbRows(5, 50) });

router.get("/top/sessions", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, sessionsSchema);

  const result = await getLongestListeningSession(
    user._id.toString(),
    start,
    end,
    nb,
  );
  res.status(200).send(result);
});

router.get("/playlists", logged, withHttpClient, async (req, res) => {
  const { client, user } = req as LoggedRequest & SpotifyRequest;

  const playlists = await client.playlists();
  res
    .status(200)
    .send(playlists.filter((playlist) => playlist.owner.id === user.spotifyId));
});

const createPlaylistBase = z.object({
  playlistId: z.string().optional(),
  name: z.string().optional(),
  sortKey: z.string().default("count"),
});

const createPlaylistFromTop = z.object({
  type: z.literal("top"),
  interval: z.object({
    start: z.preprocess(toDate, z.date()),
    end: z.preprocess(
      toDate,
      z.date().default(() => new Date()),
    ),
  }),
  nb: z.number(),
});

const createPlaylistFromAffinity = z.object({
  type: z.literal("affinity"),
  interval: z.object({
    start: z.preprocess(toDate, z.date()),
    end: z.preprocess(
      toDate,
      z.date().default(() => new Date()),
    ),
  }),
  nb: z.number(),
  userIds: z.array(z.string()),
  mode: z.nativeEnum(CollaborativeMode),
});

const createPlaylistFromSpecific = z.object({
  type: z.literal("specific"),
  songIds: z.array(z.string()),
});

const createPlaylistFromArtistTop = z.object({
  type: z.literal("top-artist"),
  nb: z.number(),
  artistId: z.string(),
});

const createPlaylist = z.discriminatedUnion("type", [
  createPlaylistBase.merge(createPlaylistFromTop),
  createPlaylistBase.merge(createPlaylistFromSpecific),
  createPlaylistBase.merge(createPlaylistFromAffinity),
  createPlaylistBase.merge(createPlaylistFromArtistTop),
]);

router.post("/playlist/create", logged, withHttpClient, async (req, res) => {
  const { client, user } = req as LoggedRequest & SpotifyRequest;
  const body = validate(req.body, createPlaylist);

  if (!body.playlistId && !body.name) {
    res.status(400).end();
    return;
  }

  let playlistName = body.name;
  let spotifyIds: string[];
  if (body.type === "top") {
    const { interval: intervalData, nb } = body;
    const items = await getBest(
      ItemType.track,
      user,
      intervalData.start,
      intervalData.end,
      nb,
      0,
    );
    spotifyIds = items.map((item) => item.track.id);
    if (!playlistName) {
      playlistName = `Top songs • ${intervalToDisplay(
        user.settings.dateFormat,
        intervalData.start,
        intervalData.end,
      )}`;
    }
  } else if (body.type === "affinity") {
    // Same rules as the collaborative routes: affinity has to be enabled and
    // the ranking always includes the requesting user.
    await checkAffinityAllowed();
    if (!playlistName) {
      playlistName = `Your Spotify Playlist • ${DateFormatter.toDayMonthYear(user.settings.dateFormat, new Date())}`;
    }
    const affinity = await getCollaborativeBestSongs(
      [user._id.toString(), ...body.userIds],
      body.interval.start,
      body.interval.end,
      body.mode,
      body.nb,
    );
    spotifyIds = affinity.map((item) => item.track.id);
  } else if (body.type === "top-artist") {
    const [artist] = await getArtists([body.artistId]);
    if (!artist) {
      res.status(404).end();
      return;
    }
    const mostListened = await getMostListenedSongOfArtist(
      user,
      artist.id,
      body.nb,
    );
    spotifyIds = mostListened.map((item) => item.track.id);
    if (!playlistName) {
      playlistName = `My top of ${artist.name}`;
    }
  } else {
    if (!playlistName) {
      playlistName = `Your Spotify Playlist • ${DateFormatter.toDayMonthYear(user.settings.dateFormat, new Date())}`;
    }
    spotifyIds = uniq(body.songIds);
  }
  if (body.playlistId) {
    await client.addToPlaylist(body.playlistId, spotifyIds);
  } else {
    await client.createPlaylist(playlistName, spotifyIds);
  }
  res.status(204).end();
});

router.get("/overview", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end } = validate(req.query, interval);
  res.status(200).send(await getOverview(user, start, end));
});

router.get("/calendar", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end } = validate(req.query, interval);
  res.status(200).send(await getCalendar(user, start, end));
});

router.get("/taste", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end } = validate(req.query, interval);
  res.status(200).send(await getTaste(user, start, end));
});

router.get("/taste/decades", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  res.status(200).send(await getDecadesPerYear(user));
});

router.get("/taste/artist_shares", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);
  res.status(200).send(await getArtistShares(user, start, end, timeSplit));
});

router.get("/taste/release_years_per", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);
  res.status(200).send(await getReleaseYearsPer(user, start, end, timeSplit));
});

const partOfDaySchema = interval.extend({
  type: z.enum(["artists", "tracks"]),
  nb: nbRows(5),
});

router.get("/top/part-of-day", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, type, nb } = validate(req.query, partOfDaySchema);
  res.status(200).send(await getBestOfPartOfDay(user, start, end, type, nb));
});

const genresSchema = interval.extend({ nb: nbRows(20) });

router.get("/genres", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, genresSchema);
  res.status(200).send(await getGenres(user, start, end, nb));
});

const discoveriesSchema = interval.extend({ nb: nbRows(5) });

const listSchema = interval.extend({ nb: nbRows(20) });

router.get("/discoveries", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, discoveriesSchema);
  res.status(200).send(await getDiscoveries(user, start, end, nb));
});

router.get("/discoveries/songs", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, discoveriesSchema);
  res.status(200).send(await getSongDiscoveries(user, start, end, nb));
});

router.get("/discoveries/overview", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, listSchema);
  res.status(200).send(await getDiscoveryOverview(user, start, end, nb));
});

router.get("/discoveries/on-repeat", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, nb } = validate(req.query, listSchema);
  res.status(200).send(await getOnRepeat(user, start, end, nb));
});

router.get("/discoveries/per", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { start, end, timeSplit } = validate(req.query, intervalPerSchema);
  res.status(200).send(await getNewPlaysPer(user, start, end, timeSplit));
});

// 3 months, 6 months, 1 year
const forgottenSchema = z.object({
  days: z.preprocess(
    toNumber,
    z.union([z.literal(91), z.literal(182), z.literal(365)]),
  ),
  nb: nbRows(20),
});

router.get("/story/forgotten", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { days, nb } = validate(req.query, forgottenSchema);
  res.status(200).send(await getForgotten(user, days, nb));
});

router.get("/on-this-day", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  res.status(200).send(await getOnThisDay(user));
});

router.get("/story/loyal", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { nb } = validate(req.query, z.object({ nb: nbRows(20) }));
  res.status(200).send(await getLoyal(user, nb));
});

router.get("/story/eras", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  res.status(200).send(await getEras(user));
});

const timelineSchema = z.object({
  type: z.enum(["artist", "album", "track"]),
  id: z.string().min(1).max(64),
});

router.get("/timeline", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { type, id } = validate(req.query, timelineSchema);
  const timeline = await getTimeline(user, type, id);
  if (!timeline) {
    res.status(200).send({ code: "NEVER_LISTENED" });
    return;
  }
  res.status(200).send(timeline);
});
