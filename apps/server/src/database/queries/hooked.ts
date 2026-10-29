import { InfosModel } from "../Models";
import { notRemoved } from "../schemas/info";
import { User } from "../schemas/user";
import { allListens, findTracks, keepOrder } from "./discoveries";
import {
  dayIn,
  findPhases,
  LATE_DAYS,
  periodDays,
  Phase,
  PHASE_PLAYS,
  PlaysOnDay,
} from "./hooks";
import { dayString } from "./insights";
import { getTimezone } from "./statsTools";

// Only aggregation features of MongoDB 4.4 are used here, some instances
// cannot run a newer MongoDB. The days are counted in the database, the
// phases found in findPhases.

type Track = Awaited<ReturnType<typeof findTracks>>[number];
// A hook or comeback of a song. knownDays and yearLater are the song's, they
// only mean something for its hook.
type Listed = Phase & {
  id: string;
  knownDays: number;
  yearLater: boolean | null;
};

// Plays per day of each song matching match, songs with fewer than minPlays
// left out early
const playsPerDay = (
  match: Record<string, unknown>,
  timezone: string,
  minPlays: number,
): Promise<{ _id: string; days: PlaysOnDay[] }[]> =>
  InfosModel.aggregate([
    { $match: match },
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
    { $match: { total: { $gte: minPlays } } },
  ]);

const sortedDays = (days: PlaysOnDay[]) =>
  days.sort((a, b) => a.day.localeCompare(b.day));

// Every hook and comeback in the whole history, as the weeks before and
// after a period matter too. Strongest first.
const findHooks = async (user: User) => {
  const timezone = getTimezone(user.settings.timezone);
  const songs = await playsPerDay(
    allListens(user).$match,
    timezone,
    PHASE_PLAYS,
  );
  const today = dayIn(timezone)(new Date());
  return songs
    .flatMap((song) => {
      const found = findPhases(sortedDays(song.days), today);
      return (found?.phases ?? [])
        .filter((p) => p.kind !== "again")
        .map((p): Listed => ({
          ...p,
          id: song._id,
          knownDays: found!.knownDays,
          yearLater: found!.yearLater,
        }));
    })
    .sort(
      (a, b) =>
        b.plays - a.plays ||
        a.start.localeCompare(b.start) ||
        a.id.localeCompare(b.id),
    );
};

// The whole history takes ~0.5 s for 127k listens, so the result is kept per
// user while the counted listens, the timezone and the day stay the same: a
// new, removed, restored or blacklisted listen changes the count.
// ponytail: an edit that adds and removes as many listens at once keeps the
// old result until the next listen or day; compare the latest change if
// that ever matters.
const cache = new Map<string, { version: string; hooks: Promise<Listed[]> }>();

const allHooks = async (user: User) => {
  const timezone = getTimezone(user.settings.timezone);
  const listens = await InfosModel.countDocuments({
    owner: user._id,
    blacklistedBy: { $exists: false },
  });
  const version = `${listens}:${timezone}:${dayIn(timezone)(new Date())}`;
  const key = user._id.toString();
  const cached = cache.get(key);
  if (cached?.version === version) {
    return cached.hooks;
  }
  const hooks = findHooks(user);
  // A failed query is not kept
  hooks.catch(() => cache.delete(key));
  cache.set(key, { version, hooks });
  return hooks;
};

const withTracks = async (hooks: Listed[]) => {
  const docs = await findTracks(hooks.map((h) => h.id));
  return keepOrder(
    hooks.map((h) => h.id),
    docs,
    (track: Track, index) => {
      const { id: _id, ...hook } = hooks[index]!;
      return { ...hook, track };
    },
  );
};

const inPeriod = (user: User, start: Date, end: Date) => {
  const [from, to] = periodDays(
    start,
    end,
    getTimezone(user.settings.timezone),
  );
  return (h: Listed) => h.start >= from && h.start <= to;
};

const isHook = (h: Listed) => h.kind === "hook";

// Songs that hooked the listener or came back in the period, strongest
// first. hooksOnly: without the comebacks.
export const getHookedSongs = async (
  user: User,
  start: Date,
  end: Date,
  nb: number,
  hooksOnly: boolean,
) => {
  const period = inPeriod(user, start, end);
  const hooks = (await allHooks(user)).filter(
    (h) => period(h) && (!hooksOnly || isHook(h)),
  );
  return withTracks(hooks.slice(0, nb));
};

// How the listener gets hooked in the period, and the hooks and comebacks per
// month or year
export const getHookSummary = async (
  user: User,
  start: Date,
  end: Date,
  step: "month" | "year",
) => {
  const hooks = (await allHooks(user)).filter(inPeriod(user, start, end));
  const late = (h: Listed) => isHook(h) && h.knownDays >= LATE_DAYS;
  const counted = hooks.filter((h) => isHook(h) && h.yearLater !== null);
  const steps = new Map<
    string,
    {
      _id: { year: number; month?: number };
      newFinds: number;
      clickedLate: number;
      cameBack: number;
    }
  >();
  for (const h of hooks) {
    const key = step === "year" ? h.start.slice(0, 4) : h.start.slice(0, 7);
    const row = steps.get(key) ?? {
      _id: {
        year: Number(h.start.slice(0, 4)),
        ...(step === "month" ? { month: Number(h.start.slice(5, 7)) } : {}),
      },
      newFinds: 0,
      clickedLate: 0,
      cameBack: 0,
    };
    row[!isHook(h) ? "cameBack" : late(h) ? "clickedLate" : "newFinds"] += 1;
    steps.set(key, row);
  }
  return {
    hooks: hooks.length,
    comebacks: hooks.filter((h) => !isHook(h)).length,
    clickedLate: hooks.filter(late).length,
    averageWeeks:
      hooks.length > 0
        ? hooks.reduce((sum, h) => sum + h.weeks, 0) / hooks.length
        : null,
    yearLater: {
      kept: counted.filter((h) => h.yearLater).length,
      counted: counted.length,
    },
    perStep: [...steps.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row),
  };
};

// The nb strongest hooks (no comebacks) of every year, newest year first
export const getHooksPerYear = async (user: User, nb: number) => {
  const byYear = new Map<number, Listed[]>();
  for (const h of (await allHooks(user)).filter(isHook)) {
    const year = Number(h.start.slice(0, 4));
    const list = byYear.get(year) ?? [];
    if (list.length < nb) list.push(h);
    byYear.set(year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const tracks = await withTracks(years.flatMap((y) => byYear.get(y)!));
  return years.map((year) => ({
    year,
    hooks: tracks.filter((t) => t.start.startsWith(`${year}-`)),
  }));
};

// A song's plays per week and phases for its page. Counted like the other
// numbers there: every listen but the removed ones, so a song by a
// blacklisted artist still shows them.
export const getSongPhases = async (user: User, trackId: string) => {
  const timezone = getTimezone(user.settings.timezone);
  const [song] = await playsPerDay(
    { owner: user._id, id: trackId, ...notRemoved },
    timezone,
    1,
  );
  return song
    ? findPhases(sortedDays(song.days), dayIn(timezone)(new Date()))
    : null;
};
