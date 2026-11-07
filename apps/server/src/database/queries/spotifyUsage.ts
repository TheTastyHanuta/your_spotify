import {
  LimitDetails,
  OutcomeObserver,
  RequestOutcome,
} from "../../tools/apis/queueHttpClient";
import { DAY_MS } from "../../tools/date";
import { logger } from "../../tools/logger";
import {
  budgetUsage,
  DEFAULT_DAILY_BUDGET,
  endpointOf,
  HOUR_MS,
  requestsBefore,
  summarize,
  USAGE_SOURCES,
  UsageSource,
} from "../../tools/spotifyUsage/summary";
import {
  GlobalPreferencesModel,
  SpotifyLimitEventModel,
  SpotifyUsageModel,
} from "../Models";
import { User } from "../schemas/user";
import { getTimezone } from "./statsTools";

const sourceOf = (url: string, source?: string): UsageSource => {
  // Logins and token refreshes, wherever they were started from
  if (new URL(url).host === "accounts.spotify.com") {
    return "auth";
  }
  return USAGE_SOURCES.includes(source as UsageSource)
    ? (source as UsageSource)
    : "other";
};

// Short 429s of the same endpoint and source this close together are one entry
const LIMIT_GROUP_MS = 5 * 60 * 1000;
// Spotify's 429 bodies are short JSON, longer ones are cut
const MAX_BODY_LENGTH = 500;

async function recordLimitEvent(
  outcome: RequestOutcome,
  source: UsageSource,
  request: { url: string; sentAt: Date },
  limit: LimitDetails,
) {
  const kind = outcome === "retried429" ? "retried" : outcome;
  if (kind !== "retried" && kind !== "ban" && kind !== "quota") {
    return;
  }
  const endpoint = endpointOf(request.url);
  const latest = {
    lastAt: request.sentAt,
    retryAfter: limit.retryAfter,
    body: limit.body.slice(0, MAX_BODY_LENGTH),
  };
  const gaveUp = limit.gaveUp ? 1 : 0;
  if (kind === "retried") {
    const grouped = await SpotifyLimitEventModel.updateOne(
      {
        kind,
        source,
        endpoint,
        lastAt: { $gte: new Date(request.sentAt.getTime() - LIMIT_GROUP_MS) },
      },
      { $set: latest, $inc: { count: 1, gaveUp } },
    );
    if (grouped.matchedCount > 0) {
      return;
    }
  }
  const previousBan = await SpotifyLimitEventModel.findOne(
    { kind: { $in: ["ban", "quota"] }, at: { $lt: request.sentAt } },
    { until: 1 },
  )
    .sort({ at: -1 })
    .lean();
  const previousBanEnd = previousBan?.until ?? null;
  const from = Math.min(
    request.sentAt.getTime() - 25 * HOUR_MS,
    previousBanEnd?.getTime() ?? Infinity,
  );
  const hours = await SpotifyUsageModel.find(
    { hour: { $gte: new Date(Math.floor(from / HOUR_MS) * HOUR_MS) } },
    { _id: 0, hour: 1, sources: 1, outcomes: 1 },
  ).lean();
  await SpotifyLimitEventModel.create({
    at: request.sentAt,
    kind,
    source,
    endpoint,
    count: 1,
    gaveUp,
    until: limit.until,
    ...latest,
    ...requestsBefore(hours, request.sentAt, previousBanEnd),
  });
}

let limitWrites = Promise.resolve();

// Counting must never hold up or fail a request, so writes are not awaited
export const recordSpotifyRequest: OutcomeObserver = (
  outcome,
  request,
  limit,
) => {
  const hour = new Date(
    Math.floor(request.sentAt.getTime() / HOUR_MS) * HOUR_MS,
  );
  const source = sourceOf(request.url, request.source);
  const counted = SpotifyUsageModel.updateOne(
    { hour },
    { $inc: { [`sources.${source}`]: 1, [`outcomes.${outcome}`]: 1 } },
    { upsert: true },
  ).catch((e) => logger.warn("Could not count a Spotify request", e));
  if (!limit) {
    return;
  }
  if (limit.until && (outcome === "ban" || outcome === "quota")) {
    GlobalPreferencesModel.updateOne(
      {},
      { $set: { spotifyBlock: { until: limit.until, kind: outcome } } },
    ).catch((e) => logger.warn("Could not store the Spotify ban", e));
  }
  // After the count, so the requests before it include this one. One at a
  // time, so close 429s do not both miss their group and create two.
  limitWrites = limitWrites
    .then(() => counted)
    .then(() => recordLimitEvent(outcome, source, request, limit))
    .catch((e) => {
      logger.warn("Could not store a Spotify rate limit", e);
    });
};

export const getStoredSpotifyBlock = async () =>
  (await GlobalPreferencesModel.findOne().select("+spotifyBlock").lean())
    ?.spotifyBlock;

export const getBudgetUsage = async () => {
  const now = new Date();
  const [hours, prefs] = await Promise.all([
    SpotifyUsageModel.find(
      { hour: { $gte: new Date(now.getTime() - 25 * HOUR_MS) } },
      { _id: 0, hour: 1, sources: 1, outcomes: 1 },
    ).lean(),
    GlobalPreferencesModel.findOne().lean(),
  ]);
  return budgetUsage(
    hours,
    now,
    prefs?.spotifyDailyBudget ?? DEFAULT_DAILY_BUDGET,
  );
};

// Rate limits the admin view lists
const RECENT_LIMITS = 50;

export const getSpotifyUsage = async (
  user: User,
  block: Parameters<typeof summarize>[3],
) => {
  const now = new Date();
  const hours = await SpotifyUsageModel.find(
    { hour: { $gte: new Date(now.getTime() - 91 * DAY_MS) } },
    { _id: 0, hour: 1, sources: 1, outcomes: 1 },
  ).lean();
  const [budget, limits] = await Promise.all([
    getBudgetUsage(),
    SpotifyLimitEventModel.find().sort({ at: -1 }).limit(RECENT_LIMITS).lean(),
  ]);
  return {
    ...summarize(hours, now, getTimezone(user.settings.timezone), block),
    budget,
    limits,
  };
};
