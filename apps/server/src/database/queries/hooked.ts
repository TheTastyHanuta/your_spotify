import { InfosModel } from "../Models";
import { User } from "../schemas/user";
import { allListens, findTracks, keepOrder } from "./discoveries";
import {
  dayIn,
  findHook,
  Hook,
  HOOK_PLAYS,
  LATE_DAYS,
  periodDays,
  PlaysOnDay,
} from "./hooks";
import { dayString } from "./insights";
import { getTimezone } from "./statsTools";

// Only aggregation features of MongoDB 4.4 are used here, some instances
// cannot run a newer MongoDB. The days are counted in the database, the hooks
// found in findHook.

type Track = Awaited<ReturnType<typeof findTracks>>[number];
type HookOf = Hook & { id: string };

// The hook of every song in the whole history (or of one song), as the days
// before and after a period matter too. Strongest first.
const findHooks = async (user: User, trackId?: string) => {
  const timezone = getTimezone(user.settings.timezone);
  const songs: { _id: string; days: PlaysOnDay[] }[] =
    await InfosModel.aggregate([
      allListens(user),
      ...(trackId ? [{ $match: { id: trackId } }] : []),
      {
        $group: {
          _id: { track: "$id", day: dayString(timezone) },
          plays: { $sum: 1 },
        },
      },
      // A hook needs HOOK_PLAYS plays, songs with fewer are left out early
      {
        $group: {
          _id: "$_id.track",
          total: { $sum: "$plays" },
          days: { $push: { day: "$_id.day", plays: "$plays" } },
        },
      },
      { $match: { total: { $gte: HOOK_PLAYS } } },
    ]);
  const today = dayIn(timezone)(new Date());
  return songs
    .flatMap((song) => {
      const hook = findHook(
        song.days.sort((a, b) => a.day.localeCompare(b.day)),
        today,
      );
      return hook ? [{ ...hook, id: song._id }] : [];
    })
    .sort(
      (a, b) =>
        b.plays - a.plays ||
        a.hook.localeCompare(b.hook) ||
        a.id.localeCompare(b.id),
    );
};

// The whole history takes ~0.5 s for 127k listens, so the result is kept per
// user while the counted listens, the timezone and the day stay the same: a
// new, removed, restored or blacklisted listen changes the count.
// ponytail: an edit that adds and removes as many listens at once keeps the
// old result until the next listen or day; compare the latest change if
// that ever matters.
const cache = new Map<string, { version: string; hooks: Promise<HookOf[]> }>();

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

const withTracks = async (hooks: HookOf[]) => {
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
  return (h: Hook) => h.hook >= from && h.hook <= to;
};

// Songs that hooked the listener in the period, strongest first
export const getHookedSongs = async (
  user: User,
  start: Date,
  end: Date,
  nb: number,
) => {
  const hooks = await allHooks(user);
  return withTracks(hooks.filter(inPeriod(user, start, end)).slice(0, nb));
};

// How the listener gets hooked in the period, and the hooks per month or year
export const getHookSummary = async (
  user: User,
  start: Date,
  end: Date,
  step: "month" | "year",
) => {
  const hooks = (await allHooks(user)).filter(inPeriod(user, start, end));
  const late = (h: Hook) => h.knownDays >= LATE_DAYS;
  const counted = hooks.filter((h) => h.yearLater !== null);
  const steps = new Map<
    string,
    {
      _id: { year: number; month?: number };
      newFinds: number;
      clickedLate: number;
    }
  >();
  for (const h of hooks) {
    const key = step === "year" ? h.hook.slice(0, 4) : h.hook.slice(0, 7);
    const row = steps.get(key) ?? {
      _id: {
        year: Number(h.hook.slice(0, 4)),
        ...(step === "month" ? { month: Number(h.hook.slice(5, 7)) } : {}),
      },
      newFinds: 0,
      clickedLate: 0,
    };
    row[late(h) ? "clickedLate" : "newFinds"] += 1;
    steps.set(key, row);
  }
  return {
    hooks: hooks.length,
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

// The nb strongest hooks of every year, newest year first
export const getHooksPerYear = async (user: User, nb: number) => {
  const byYear = new Map<number, HookOf[]>();
  for (const h of await allHooks(user)) {
    const year = Number(h.hook.slice(0, 4));
    const list = byYear.get(year) ?? [];
    if (list.length < nb) list.push(h);
    byYear.set(year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const tracks = await withTracks(years.flatMap((y) => byYear.get(y)!));
  return years.map((year) => ({
    year,
    hooks: tracks.filter((t) => t.hook.startsWith(`${year}-`)),
  }));
};

export const getSongHook = async (user: User, trackId: string) => {
  const [hook] = await findHooks(user, trackId);
  if (!hook) {
    return null;
  }
  const { id: _id, ...rest } = hook;
  return rest;
};
