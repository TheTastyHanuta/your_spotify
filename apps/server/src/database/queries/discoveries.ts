import { Timesplit } from "../../tools/types";
import { ArtistModel, InfosModel } from "../Models";
import { User } from "../schemas/user";
import { dayNumber, dayString, DAY_MS } from "./insights";
import {
  basicMatch,
  getGroupByDateProjection,
  getGroupingByTimeSplit,
  getTimezone,
  sortByTimeSplit,
} from "./statsTools";
import { getTracks } from "./track";

// Only aggregation features of MongoDB 4.4 are used here, some instances
// cannot run a newer MongoDB.

const NB_LIST = 20;
const NB_STUCK = 20;
// Back after a break: known before (at least this many plays), then not
// played for this long
const BREAK_MIN_PLAYS = 10;
const BREAK_DAYS = 182;
// On repeat: the most plays inside any window of this many days
const REPEAT_DAYS = 7;
const REPEAT_MIN_PLAYS = 5;
// Kept listening: played again this many days after the first listen
const KEPT_DAYS = 30;
// Did they stick: discovered artists with at least this many plays, stuck
// when played this many times from this many days after the first listen.
// Faded only once that window had a month to fill, too early before.
const STICK_MIN_PLAYS = 3;
const STICK_DAYS = 91;
const FADED_DAYS = STICK_DAYS + 30;

export const allListens = (user: User) => ({
  $match: { owner: user._id, blacklistedBy: { $exists: 0 } },
});

const inPeriod = (start: Date, end: Date, field = "$played_at") => ({
  $and: [{ $gt: [field, start] }, { $lt: [field, end] }],
});

export const findArtists = (ids: string[]) =>
  ArtistModel.find({ id: { $in: ids } })
    .select("id name images")
    .lean();

// Same fields as the part of day query
export const findTracks = (ids: string[]) =>
  getTracks(ids)
    .select("id name album artists")
    .populate("full_album", "id name images")
    .populate("full_artists", "id name")
    .lean();

export const keepOrder = <T extends { id: string }, R>(
  ids: string[],
  docs: T[],
  build: (doc: T, index: number) => R,
) => {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return ids.flatMap((id, index) => {
    const doc = byId.get(id);
    return doc ? [build(doc, index)] : [];
  });
};

// Summary, songs new by artists already known, comebacks and whether the
// artists discovered in the period stuck
export const getDiscoveryOverview = async (
  user: User,
  start: Date,
  end: Date,
) => {
  const now = new Date();
  const [tracks, artists]: [
    { _id: string; first: Date; artist: string; plays: number }[],
    {
      _id: string;
      first: Date;
      plays: number;
      total: number;
      playsBefore: number;
      lastBefore: Date | null;
      firstIn: Date | null;
      late: number;
    }[],
  ] = await Promise.all([
    InfosModel.aggregate([
      allListens(user),
      {
        $group: {
          _id: "$id",
          // The artist of the first listen: after an ISRC merge, listens of
          // one song can carry different primary artists. Documents compare
          // field by field, so this is the earliest listen.
          firstPlay: {
            $min: { played_at: "$played_at", artist: "$primaryArtistId" },
          },
          plays: { $sum: { $cond: [inPeriod(start, end), 1, 0] } },
        },
      },
      { $match: { plays: { $gt: 0 } } },
      {
        $project: {
          first: "$firstPlay.played_at",
          artist: "$firstPlay.artist",
          plays: 1,
        },
      },
    ]),
    InfosModel.aggregate([
      allListens(user),
      {
        $group: {
          _id: "$primaryArtistId",
          first: { $min: "$played_at" },
          total: { $sum: 1 },
          plays: { $sum: { $cond: [inPeriod(start, end), 1, 0] } },
          playsBefore: {
            $sum: { $cond: [{ $lte: ["$played_at", start] }, 1, 0] },
          },
          lastBefore: {
            $max: {
              $cond: [{ $lte: ["$played_at", start] }, "$played_at", null],
            },
          },
          firstIn: {
            $min: { $cond: [inPeriod(start, end), "$played_at", null] },
          },
          // ponytail: every play after the period start of every artist is
          // held in memory here, about 3 MB for 124k listens. Filter to the
          // discovered artists first if histories get much bigger.
          after: {
            $push: {
              $cond: [{ $gt: ["$played_at", start] }, "$played_at", null],
            },
          },
        },
      },
      // An artist discovered in the period was played in it too
      { $match: { plays: { $gt: 0 } } },
      {
        $project: {
          first: 1,
          total: 1,
          plays: 1,
          playsBefore: 1,
          lastBefore: 1,
          firstIn: 1,
          late: {
            $size: {
              $filter: {
                input: "$after",
                cond: {
                  $gte: ["$$this", { $add: ["$first", STICK_DAYS * DAY_MS] }],
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  const artistFirst = new Map(artists.map((a) => [a._id, a.first]));
  const isNew = (first: Date) => first > start;

  const totalPlays = tracks.reduce((sum, t) => sum + t.plays, 0);
  const newTracks = tracks.filter((t) => isNew(t.first));
  const knownArtistTracks = newTracks
    .filter((t) => {
      const first = artistFirst.get(t.artist);
      return first !== undefined && !isNew(first);
    })
    .sort((a, b) => b.plays - a.plays || a._id.localeCompare(b._id));

  const discovered = artists.filter((a) => isNew(a.first));
  const comebacks = artists
    .filter(
      (a) =>
        a.playsBefore >= BREAK_MIN_PLAYS &&
        a.lastBefore &&
        a.firstIn &&
        a.firstIn.getTime() - a.lastBefore.getTime() >= BREAK_DAYS * DAY_MS,
    )
    .sort((a, b) => b.plays - a.plays || a._id.localeCompare(b._id))
    .slice(0, NB_LIST);

  const counted = discovered.filter((a) => a.total >= STICK_MIN_PLAYS);
  const stuck = counted
    .filter((a) => a.late >= STICK_MIN_PLAYS)
    .sort((a, b) => b.late - a.late || a._id.localeCompare(b._id));
  const early = counted.filter(
    (a) =>
      a.late < STICK_MIN_PLAYS &&
      a.first.getTime() + FADED_DAYS * DAY_MS > now.getTime(),
  );

  const shownTracks = knownArtistTracks.slice(0, NB_LIST);
  const shownStuck = stuck.slice(0, NB_STUCK);
  const [trackDocs, artistDocs] = await Promise.all([
    findTracks(shownTracks.map((t) => t._id)),
    findArtists([...comebacks, ...shownStuck].map((a) => a._id)),
  ]);

  return {
    plays: totalPlays,
    newArtists: discovered.length,
    newTracks: newTracks.length,
    newTracksByKnownArtists: knownArtistTracks.length,
    newTrackPlays: newTracks.reduce((sum, t) => sum + t.plays, 0),
    knownArtistTracks: keepOrder(
      shownTracks.map((t) => t._id),
      trackDocs,
      (track, index) => ({
        track,
        plays: shownTracks[index]!.plays,
        first: shownTracks[index]!.first,
      }),
    ),
    comebacks: keepOrder(
      comebacks.map((a) => a._id),
      artistDocs,
      (artist, index) => ({
        artist,
        plays: comebacks[index]!.plays,
        lastBefore: comebacks[index]!.lastBefore!,
        back: comebacks[index]!.firstIn!,
      }),
    ),
    stick: {
      stuck: stuck.length,
      faded: counted.length - stuck.length - early.length,
      early: early.length,
      artists: keepOrder(
        shownStuck.map((a) => a._id),
        artistDocs,
        (artist, index) => ({ artist, late: shownStuck[index]!.late }),
      ),
    },
  };
};

// Songs with the most plays inside any REPEAT_DAYS days of the period
export const getOnRepeat = async (user: User, start: Date, end: Date) => {
  const timezone = getTimezone(user.settings.timezone);
  const rows: { _id: string; days: { day: string; plays: number }[] }[] =
    await InfosModel.aggregate([
      ...basicMatch(user._id, start, end),
      {
        $group: {
          _id: { track: "$id", day: dayString(timezone) },
          plays: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.track",
          total: { $sum: "$plays" },
          days: { $push: { day: "$_id.day", plays: "$plays" } },
        },
      },
      { $match: { total: { $gte: REPEAT_MIN_PLAYS } } },
    ]);

  // MongoDB 5's window functions would do this in the database
  const best = rows
    .map((row) => ({ id: row._id, ...bestWindow(row.days) }))
    .filter((row) => row.plays >= REPEAT_MIN_PLAYS)
    .sort(
      (a, b) =>
        b.plays - a.plays ||
        a.from.localeCompare(b.from) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, NB_LIST);

  const docs = await findTracks(best.map((row) => row.id));
  return keepOrder(
    best.map((row) => row.id),
    docs,
    (track, index) => {
      const { plays, from, to } = best[index]!;
      return { track, plays, from, to };
    },
  );
};

// Songs first heard in the period that you kept playing: played again at
// least KEPT_DAYS after the first listen (that play may come after the
// period). Most played in the period first, with the number of months of the
// period they were played in.
export const getSongDiscoveries = async (
  user: User,
  start: Date,
  end: Date,
  nb: number,
) => {
  const timezone = getTimezone(user.settings.timezone);
  const rows: {
    _id: string;
    first: Date;
    plays: number;
    months: (string | null)[];
  }[] = await InfosModel.aggregate([
    allListens(user),
    {
      $group: {
        _id: "$id",
        first: { $min: "$played_at" },
        last: { $max: "$played_at" },
        plays: { $sum: { $cond: [inPeriod(start, end), 1, 0] } },
        months: {
          $addToSet: {
            $cond: [
              inPeriod(start, end),
              {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$played_at",
                  timezone,
                },
              },
              null,
            ],
          },
        },
      },
    },
    {
      $match: {
        first: { $gt: start, $lt: end },
        $expr: { $gte: ["$last", { $add: ["$first", KEPT_DAYS * DAY_MS] }] },
      },
    },
    { $sort: { plays: -1, _id: 1 } },
    { $limit: nb },
  ]);

  const docs = await findTracks(rows.map((row) => row._id));
  return keepOrder(
    rows.map((row) => row._id),
    docs,
    (track, index) => {
      const { plays, first, months } = rows[index]!;
      return { track, plays, first, months: months.filter(Boolean).length };
    },
  );
};

// days: "YYYY-MM-DD" with plays. The window of REPEAT_DAYS days with the most
// plays, from its first to its last day with plays.
export function bestWindow(days: { day: string; plays: number }[]) {
  const sorted = days
    .map((d) => ({ ...d, n: dayNumber(d.day) }))
    .sort((a, b) => a.n - b.n);
  let best = { plays: 0, from: "", to: "" };
  let sum = 0;
  let first = 0;
  for (const day of sorted) {
    sum += day.plays;
    while (sorted[first]!.n <= day.n - REPEAT_DAYS) {
      sum -= sorted[first]!.plays;
      first += 1;
    }
    if (sum > best.plays) {
      best = { plays: sum, from: sorted[first]!.day, to: day.day };
    }
  }
  return best;
}

// Plays per time step, and the plays of songs heard for the first time in
// the period and in that same step
export const getNewPlaysPer = async (
  user: User,
  start: Date,
  end: Date,
  timeSplit: Timesplit,
) => {
  const timezone = user.settings.timezone;
  return InfosModel.aggregate([
    { $match: { owner: user._id, blacklistedBy: { $exists: 0 } } },
    {
      $group: {
        _id: "$id",
        first: { $min: "$played_at" },
        dates: { $push: { $cond: [inPeriod(start, end), "$played_at", null] } },
      },
    },
    { $unwind: "$dates" },
    { $match: { dates: { $ne: null } } },
    {
      $project: {
        ...getGroupByDateProjection(timezone, "$dates"),
        firstStep: getGroupByDateProjection(timezone, "$first"),
        newInPeriod: { $gt: ["$first", start] },
      },
    },
    {
      $group: {
        _id: getGroupingByTimeSplit(timeSplit),
        count: { $sum: 1 },
        newCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$newInPeriod",
                  {
                    $eq: [
                      getGroupingByTimeSplit(timeSplit),
                      getGroupingByTimeSplit(timeSplit, "firstStep"),
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    ...sortByTimeSplit(timeSplit, "_id"),
  ]) as Promise<
    { _id: Record<string, number> | null; count: number; newCount: number }[]
  >;
};
