import { OutcomeObserver } from "../../tools/apis/queueHttpClient";
import { logger } from "../../tools/logger";
import {
  HOUR_MS,
  summarize,
  USAGE_SOURCES,
  UsageSource,
} from "../../tools/spotifyUsage/summary";
import { GlobalPreferencesModel, SpotifyUsageModel } from "../Models";
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

// Counting must never hold up or fail a request, so writes are not awaited
export const recordSpotifyRequest: OutcomeObserver = (
  outcome,
  request,
  rateLimitedUntil,
) => {
  const hour = new Date(
    Math.floor(request.sentAt.getTime() / HOUR_MS) * HOUR_MS,
  );
  SpotifyUsageModel.updateOne(
    { hour },
    {
      $inc: {
        [`sources.${sourceOf(request.url, request.source)}`]: 1,
        [`outcomes.${outcome}`]: 1,
      },
    },
    { upsert: true },
  ).catch((e) => logger.warn("Could not count a Spotify request", e));
  if (rateLimitedUntil && (outcome === "ban" || outcome === "quota")) {
    GlobalPreferencesModel.updateOne(
      {},
      { $set: { spotifyBlock: { until: rateLimitedUntil, kind: outcome } } },
    ).catch((e) => logger.warn("Could not store the Spotify ban", e));
  }
};

export const getStoredSpotifyBlock = async () =>
  (await GlobalPreferencesModel.findOne().select("+spotifyBlock").lean())
    ?.spotifyBlock;

export const getSpotifyUsage = async (
  user: User,
  block: Parameters<typeof summarize>[3],
) => {
  const now = new Date();
  const hours = await SpotifyUsageModel.find(
    { hour: { $gte: new Date(now.getTime() - 91 * 24 * HOUR_MS) } },
    { _id: 0, hour: 1, sources: 1, outcomes: 1 },
  ).lean();
  return summarize(hours, now, getTimezone(user.settings.timezone), block);
};
