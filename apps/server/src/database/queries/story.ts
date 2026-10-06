import { genresOf } from "../../tools/genres";
import { ArtistModel, InfosModel } from "../Models";
import { User } from "../schemas/user";
import { allListens, findArtists, findTracks, keepOrder } from "./discoveries";
import { DAY_MS } from "./insights";
import { getTimezone } from "./statsTools";
import { getTracks } from "./track";

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

// Eras: stretches of months one artist or genre clearly led. A month's
// leader is found over the months around it, so one wild month is not an
// era (that is what "on repeat" shows).
const ERA_WINDOW = 1; // months on each side
const ERA_LEAD = 1.2; // times the plays of number two
const ERA_MIN_SHARE = { artist: 0.03, genre: 0.05 }; // of all plays
const ERA_MIN_MONTH_PLAYS = 30;
const ERA_MAX_GAP = 1; // months without a leader bridged inside an era
const ERA_MIN_MONTHS = 3;
const NB_ERA_GENRE_ARTISTS = 3;

// counts[i]: plays per artist or genre in months[i], totals[i]: all plays
export function findEras(
  months: string[],
  counts: Map<string, number>[],
  totals: number[],
  minShare: number,
) {
  const leaders = months.map((_, i) => {
    if (totals[i]! < ERA_MIN_MONTH_PLAYS) return null;
    const sum = new Map<string, number>();
    let total = 0;
    const from = Math.max(0, i - ERA_WINDOW);
    const to = Math.min(months.length - 1, i + ERA_WINDOW);
    for (let j = from; j <= to; j += 1) {
      total += totals[j]!;
      for (const [key, n] of counts[j]!) sum.set(key, (sum.get(key) ?? 0) + n);
    }
    const [first, second] = [...sum.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    if (
      !first ||
      first[1] < minShare * total ||
      first[1] < ERA_LEAD * (second?.[1] ?? 0) ||
      // Led by the months around it but not played in it
      !counts[i]!.has(first[0])
    ) {
      return null;
    }
    return first[0];
  });

  const runs: { key: string; from: number; to: number }[] = [];
  leaders.forEach((key, i) => {
    if (!key) return;
    const last = runs.at(-1);
    if (last?.key === key && i - last.to - 1 <= ERA_MAX_GAP) {
      last.to = i;
    } else {
      runs.push({ key, from: i, to: i });
    }
  });
  return runs
    .filter((run) => run.to - run.from + 1 >= ERA_MIN_MONTHS)
    .map((run) => {
      let plays = 0;
      let total = 0;
      for (let i = run.from; i <= run.to; i += 1) {
        plays += counts[i]!.get(run.key) ?? 0;
        total += totals[i]!;
      }
      return {
        key: run.key,
        from: months[run.from]!,
        to: months[run.to]!,
        plays,
        total,
      };
    });
}

// Every "YYYY-MM" from `first` to `last`
const monthRange = (first: string, last: string) => {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number) as [number, number];
  for (
    let current = first;
    current <= last;
    current = `${year}-${String(month).padStart(2, "0")}`
  ) {
    months.push(current);
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return months;
};

export const getEras = async (user: User) => {
  const timezone = getTimezone(user.settings.timezone);
  const monthOf = {
    $dateToString: { format: "%Y-%m", date: "$played_at", timezone },
  };
  const rows: { _id: { month: string; artist: string }; plays: number }[] =
    await InfosModel.aggregate([
      allListens(user),
      {
        $group: {
          _id: { month: monthOf, artist: "$primaryArtistId" },
          plays: { $sum: 1 },
        },
      },
    ]);
  if (rows.length === 0)
    return { first: null, last: null, artists: [], genres: [] };

  const sortedMonths = rows.map((row) => row._id.month).sort();
  const months = monthRange(sortedMonths[0]!, sortedMonths.at(-1)!);
  const index = new Map(months.map((month, i) => [month, i]));
  const artistDocs = await ArtistModel.find({
    id: { $in: [...new Set(rows.map((row) => row._id.artist))] },
  })
    .select("id name images genres mbGenres")
    .lean();
  const artistById = new Map(artistDocs.map((artist) => [artist.id, artist]));
  const genreOf = (id: string) => {
    const artist = artistById.get(id);
    return artist ? genresOf(artist)[0] : undefined;
  };

  const totals = months.map(() => 0);
  const byArtist = months.map(() => new Map<string, number>());
  const byGenre = months.map(() => new Map<string, number>());
  for (const { _id, plays } of rows) {
    const i = index.get(_id.month)!;
    totals[i]! += plays;
    byArtist[i]!.set(_id.artist, plays);
    const genre = genreOf(_id.artist);
    if (genre) byGenre[i]!.set(genre, (byGenre[i]!.get(genre) ?? 0) + plays);
  }

  const artistEras = findEras(months, byArtist, totals, ERA_MIN_SHARE.artist);
  const genreEras = findEras(months, byGenre, totals, ERA_MIN_SHARE.genre);

  // The most played song of each artist era
  const songRows: {
    _id: { month: string; artist: string; track: string };
    plays: number;
  }[] = await InfosModel.aggregate([
    {
      $match: {
        owner: user._id,
        blacklistedBy: { $exists: 0 },
        primaryArtistId: { $in: [...new Set(artistEras.map((e) => e.key))] },
      },
    },
    {
      $group: {
        _id: { month: monthOf, artist: "$primaryArtistId", track: "$id" },
        plays: { $sum: 1 },
      },
    },
  ]);
  const topTracks = artistEras.map((era) => {
    const plays = new Map<string, number>();
    for (const { _id, plays: n } of songRows) {
      if (
        _id.artist === era.key &&
        _id.month >= era.from &&
        _id.month <= era.to
      ) {
        plays.set(_id.track, (plays.get(_id.track) ?? 0) + n);
      }
    }
    return [...plays.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0];
  });
  const trackDocs = await getTracks(
    topTracks.filter((id): id is string => Boolean(id)),
  )
    .select("id name")
    .lean();
  const trackById = new Map(trackDocs.map((track) => [track.id, track]));

  const shortArtist = (id: string) => {
    const artist = artistById.get(id);
    return (
      artist && { id: artist.id, name: artist.name, images: artist.images }
    );
  };

  return {
    first: months[0]!,
    last: months.at(-1)!,
    artists: artistEras.flatMap(({ key, ...era }, i) => {
      const artist = shortArtist(key);
      const track = topTracks[i] && trackById.get(topTracks[i]!);
      return artist
        ? [
            {
              ...era,
              artist,
              track: track ? { id: track.id, name: track.name } : null,
            },
          ]
        : [];
    }),
    genres: genreEras.map(({ key, ...era }) => {
      // Its most played artists during the era
      const plays = new Map<string, number>();
      for (let i = index.get(era.from)!; i <= index.get(era.to)!; i += 1) {
        for (const [artist, n] of byArtist[i]!) {
          if (genreOf(artist) === key)
            plays.set(artist, (plays.get(artist) ?? 0) + n);
        }
      }
      const artists = [...plays.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, NB_ERA_GENRE_ARTISTS)
        .flatMap(([id]) => shortArtist(id) ?? []);
      return { ...era, genre: key, artists };
    }),
  };
};
