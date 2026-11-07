import { Router } from "express";
import { z } from "zod";

import { getGlobalPreferences, updateGlobalPreferences } from "../database";
import { getSpotifyUsage } from "../database/queries/spotifyUsage";
import { spotifyHttpClientFactory } from "../tools/apis/queuedHttpClient.providers";
import { resumeBudgetWaits } from "../tools/importers/importer";
import { logger } from "../tools/logger";
import { admin, logged, validate } from "../tools/middleware";
import { MIN_DAILY_BUDGET } from "../tools/spotifyUsage/summary";
import { LoggedRequest } from "../tools/types";

export const router = Router();

router.get("/preferences", async (req, res) => {
  const preferences = await getGlobalPreferences();
  res.status(200).send(preferences);
});

const updateGlobalPreferencesSchema = z.object({
  allowRegistrations: z.boolean().optional(),
  allowAffinity: z.boolean().optional(),
  // Smaller budgets leave an import too little room to store anything
  spotifyDailyBudget: z.number().int().min(MIN_DAILY_BUDGET).optional(),
});

router.post("/preferences", logged, admin, async (req, res) => {
  const modifications = validate(req.body, updateGlobalPreferencesSchema);

  const newPrefs = await updateGlobalPreferences(modifications);
  if (modifications.spotifyDailyBudget !== undefined) {
    // The ISRC lookups check again on their own within minutes
    resumeBudgetWaits().catch(logger.error);
  }
  res.status(200).send(newPrefs);
});

router.get("/spotify-usage", logged, admin, async (req, res) => {
  const { user } = req as LoggedRequest;
  res
    .status(200)
    .send(await getSpotifyUsage(user, spotifyHttpClientFactory.rateLimit));
});
