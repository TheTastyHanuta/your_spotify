import { genresOf } from "../../tools/genres";
import { ArtistModel, InfosModel } from "../Models";
import { User } from "../schemas/user";
import { matchArtistListens } from "./artist";
import { basicMatch, getTimezone } from "./statsTools";
import { getTracks } from "./track";

// Only aggregation features of MongoDB 4.4 are used here, some instances
// cannot run a newer MongoDB.

const DAY_MS = 24 * 60 * 60 * 1000;

const dayString = (timezone: string) => ({
  $dateToString: { format: "%Y-%m-%d", date: "$played_at", timezone },
});

const perDay = (timezone: string) => [
  {
    $group: {
      _id: dayString(timezone),
      plays: { $sum: 1 },
      durationMs: { $sum: "$durationMs" },
    },
  },
  { $sort: { _id: 1 as const } },
];

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

// days: sorted "YYYY-MM-DD" in the user's timezone. The current streak still
// counts when its last day is yesterday, since today may not be over.
export function computeStreaks(days: string[], today: string) {
  let longest = { days: 0, start: "", end: "" };
  let runStart = 0;
  for (let i = 0; i < days.length; i += 1) {
    if (i === 0 || dayNumber(days[i]!) - dayNumber(days[i - 1]!) !== 1) {
      runStart = i;
    }
    if (i - runStart + 1 > longest.days) {
      longest = {
        days: i - runStart + 1,
        start: days[runStart]!,
        end: days[i]!,
      };
    }
  }
  const last = days.at(-1);
  const current =
    last && [0, 1].includes(dayNumber(today) - dayNumber(last))
      ? days.length - runStart
      : 0;
  return { longest: longest.days > 0 ? longest : null, current };
}

// Artists or tracks listened to for the first time ever during the period
const countFirstListens = async (
  user: User,
  field: "primaryArtistId" | "id",
  start: Date,
  end: Date,
) => {
  const [result] = await InfosModel.aggregate([
    { $match: { owner: user._id, blacklistedBy: { $exists: 0 } } },
    { $group: { _id: `$${field}`, first: { $min: "$played_at" } } },
    { $match: { first: { $gt: start, $lt: end } } },
    { $count: "count" },
  ]);
  return (result?.count ?? 0) as number;
};

export const getOverview = async (user: User, start: Date, end: Date) => {
  const timezone = getTimezone(user.settings.timezone);
  const distinct = (field: string) => [
    { $group: { _id: `$${field}` } },
    { $count: "count" },
  ];
  const [[facets], newArtists, newTracks] = await Promise.all([
    InfosModel.aggregate([
      ...basicMatch(user._id, start, end),
      {
        $facet: {
          tracks: distinct("id"),
          artists: distinct("primaryArtistId"),
          albums: distinct("albumId"),
          days: perDay(timezone),
          heatmap: [
            {
              $group: {
                _id: {
                  // 1 is Monday, 7 is Sunday
                  weekday: { $isoDayOfWeek: { date: "$played_at", timezone } },
                  hour: { $hour: { date: "$played_at", timezone } },
                },
                plays: { $sum: 1 },
                durationMs: { $sum: "$durationMs" },
              },
            },
          ],
        },
      },
    ]),
    countFirstListens(user, "primaryArtistId", start, end),
    countFirstListens(user, "id", start, end),
  ]);

  const days: { _id: string; plays: number; durationMs: number }[] =
    facets.days;
  const busiestDay = days.reduce<(typeof days)[number] | undefined>(
    (best, day) => (!best || day.durationMs > best.durationMs ? day : best),
    undefined,
  );
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    end < now ? end : now,
  );

  return {
    plays: days.reduce((sum, day) => sum + day.plays, 0),
    durationMs: days.reduce((sum, day) => sum + day.durationMs, 0),
    tracks: (facets.tracks[0]?.count ?? 0) as number,
    artists: (facets.artists[0]?.count ?? 0) as number,
    albums: (facets.albums[0]?.count ?? 0) as number,
    newArtists,
    newTracks,
    activeDays: days.length,
    busiestDay: busiestDay && {
      date: busiestDay._id,
      plays: busiestDay.plays,
      durationMs: busiestDay.durationMs,
    },
    streaks: computeStreaks(
      days.map((day) => day._id),
      today,
    ),
    heatmap: (facets.heatmap as any[]).map((cell) => ({
      weekday: cell._id.weekday as number,
      hour: cell._id.hour as number,
      plays: cell.plays as number,
      durationMs: cell.durationMs as number,
    })),
  };
};

export const getCalendar = async (user: User, start: Date, end: Date) => {
  const days = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    ...perDay(getTimezone(user.settings.timezone)),
  ]);
  return days.map((day) => ({
    date: day._id as string,
    plays: day.plays as number,
    durationMs: day.durationMs as number,
  }));
};

// Upper bounds in minutes of the track length buckets, the last one is open
const LENGTH_BUCKETS = [2, 3, 4, 5];

// Release years of what was listened to, and what kind of tracks it was
export const getTaste = async (user: User, start: Date, end: Date) => {
  const perTrack: {
    _id: { track: string };
    plays: number;
    durationMs: number;
    releaseDate?: string;
    albumType?: string;
    explicit?: boolean;
    trackDurationMs?: number;
  }[] = await InfosModel.aggregate([
    ...basicMatch(user._id, start, end),
    {
      $group: {
        // The listened album, a track can be on several
        _id: { track: "$id", album: "$albumId" },
        plays: { $sum: 1 },
        durationMs: { $sum: "$durationMs" },
      },
    },
    {
      $lookup: {
        from: "albums",
        localField: "_id.album",
        foreignField: "id",
        as: "album",
      },
    },
    {
      $lookup: {
        from: "tracks",
        localField: "_id.track",
        foreignField: "id",
        as: "track",
      },
    },
    {
      $project: {
        plays: 1,
        durationMs: 1,
        releaseDate: { $arrayElemAt: ["$album.release_date", 0] },
        albumType: { $arrayElemAt: ["$album.album_type", 0] },
        explicit: { $arrayElemAt: ["$track.explicit", 0] },
        trackDurationMs: { $arrayElemAt: ["$track.duration_ms", 0] },
      },
    },
  ]);

  const years = new Map<
    number,
    { plays: number; durationMs: number; tracks: Map<string, number> }
  >();
  const albumTypes: Record<string, number> = {};
  const explicit = { explicit: 0, clean: 0 };
  const lengths = new Array<number>(LENGTH_BUCKETS.length + 1).fill(0);
  for (const row of perTrack) {
    const year = Number(row.releaseDate?.slice(0, 4));
    if (year > 1900) {
      const entry = years.get(year) ?? {
        plays: 0,
        durationMs: 0,
        tracks: new Map<string, number>(),
      };
      entry.plays += row.plays;
      entry.durationMs += row.durationMs;
      // A track can be listened to from several albums of the same year
      const track = row._id.track;
      entry.tracks.set(track, (entry.tracks.get(track) ?? 0) + row.plays);
      years.set(year, entry);
    }
    const type = row.albumType ?? "unknown";
    albumTypes[type] = (albumTypes[type] ?? 0) + row.plays;
    explicit[row.explicit ? "explicit" : "clean"] += row.plays;
    if (row.trackDurationMs !== undefined) {
      const minutes = row.trackDurationMs / 60_000;
      const bucket = LENGTH_BUCKETS.findIndex((max) => minutes < max);
      lengths[bucket === -1 ? LENGTH_BUCKETS.length : bucket]! += row.plays;
    }
  }

  // The most played track of each release year
  const topOf = (tracks: Map<string, number>) =>
    [...tracks.entries()].reduce((best, track) =>
      track[1] > best[1] ? track : best,
    );
  const tops = await getTracks(
    [...years.values()].map((y) => topOf(y.tracks)[0]),
  )
    .select("id name album artists")
    .populate("full_album", "id name images")
    .populate("full_artists", "id name")
    .lean();
  const topsById = new Map(tops.map((track) => [track.id, track]));

  return {
    years: [...years.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, entry]) => {
        const [id, plays] = topOf(entry.tracks);
        return {
          year,
          plays: entry.plays,
          durationMs: entry.durationMs,
          top: { track: topsById.get(id), plays },
        };
      }),
    albumTypes,
    explicit,
    // Plays per track length: < 2 min, 2-3, 3-4, 4-5, 5 min and more
    lengths,
  };
};

// Plays per genre. An artist has up to 6 genres and counts for each, so the
// genres overlap and their plays add up to more than coveredPlays.
export const getGenres = async (
  user: User,
  start: Date,
  end: Date,
  nb: number,
) => {
  const perArtist: { _id: string; plays: number; durationMs: number }[] =
    await InfosModel.aggregate([
      ...basicMatch(user._id, start, end),
      {
        $group: {
          _id: "$primaryArtistId",
          plays: { $sum: 1 },
          durationMs: { $sum: "$durationMs" },
        },
      },
      { $sort: { plays: -1 } },
    ]);
  const artists = await ArtistModel.find(
    { id: { $in: perArtist.map((row) => row._id) } },
    { _id: 0, id: 1, name: 1, images: 1, genres: 1, mbGenres: 1 },
  ).lean();
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

  const genres = new Map<
    string,
    { plays: number; durationMs: number; artists: typeof artists }
  >();
  let totalPlays = 0;
  let coveredPlays = 0;
  // Sorted by plays, so each genre gets its artists from most to least played
  for (const row of perArtist) {
    totalPlays += row.plays;
    const artist = artistsById.get(row._id);
    const artistGenres = artist ? genresOf(artist) : [];
    if (!artist || artistGenres.length === 0) {
      continue;
    }
    coveredPlays += row.plays;
    for (const genre of artistGenres) {
      const entry = genres.get(genre) ?? {
        plays: 0,
        durationMs: 0,
        artists: [],
      };
      entry.plays += row.plays;
      entry.durationMs += row.durationMs;
      entry.artists.push(artist);
      genres.set(genre, entry);
    }
  }

  return {
    totalPlays,
    coveredPlays,
    genres: [...genres.entries()]
      .sort(([, a], [, b]) => b.plays - a.plays)
      .slice(0, nb)
      .map(([genre, entry]) => ({
        genre,
        plays: entry.plays,
        durationMs: entry.durationMs,
        artists: entry.artists
          .slice(0, 3)
          .map(({ id, name, images }) => ({ id, name, images })),
      })),
  };
};

export type TimelineType = "artist" | "album" | "track";

type Counted<Id> = { _id: Id; plays: number; durationMs: number }[];
type TimelineFacets = {
  months: Counted<{ year: number; month: number }>;
  weekdays: Counted<number>;
  hours: Counted<number>;
};

// Plays per month, ISO weekday (1 is Monday) and hour. Months are
// { year, month } like the other per-month stats, so the client can fill the
// months without listens. Embedded _id documents sort field by field, so
// months sort by year first.
const timelineFacets = (timezone: string) => {
  const count = (key: object) => [
    {
      $group: {
        _id: key,
        plays: { $sum: 1 },
        durationMs: { $sum: "$durationMs" },
      },
    },
    { $sort: { _id: 1 as const } },
  ];
  return {
    months: count({
      year: { $year: { date: "$played_at", timezone } },
      month: { $month: { date: "$played_at", timezone } },
    }),
    weekdays: count({ $isoDayOfWeek: { date: "$played_at", timezone } }),
    hours: count({ $hour: { date: "$played_at", timezone } }),
  };
};

// Listens of one item over its whole history, and all the user's listens
// between its first and last listen, to compare the item with the usual
// listening and give its share of each month. Like the other detail pages,
// blacklisted listens count, in both, so a share never exceeds 100%.
export const getTimeline = async (
  user: User,
  type: TimelineType,
  id: string,
) => {
  const timezone = getTimezone(user.settings.timezone);
  const match = {
    artist: matchArtistListens(user, id),
    album: { owner: user._id, albumId: id },
    track: { owner: user._id, id },
  }[type];
  const [item] = await InfosModel.aggregate<
    TimelineFacets & { range: { first: Date; last: Date }[] }
  >([
    { $match: match },
    {
      $facet: {
        ...timelineFacets(timezone),
        range: [
          {
            $group: {
              _id: null,
              first: { $min: "$played_at" },
              last: { $max: "$played_at" },
            },
          },
        ],
      },
    },
  ]);
  const range = item?.range[0];
  if (!item || !range) {
    return null;
  }
  const [overall] = await InfosModel.aggregate<TimelineFacets>([
    {
      $match: {
        owner: user._id,
        played_at: { $gte: range.first, $lte: range.last },
      },
    },
    { $facet: timelineFacets(timezone) },
  ]);
  const { months, weekdays, hours } = item;
  return { months, weekdays, hours, overall: overall! };
};
