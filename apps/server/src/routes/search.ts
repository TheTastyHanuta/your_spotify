import { Router } from "express";
import { z } from "zod";

import { searchArtist, searchTrack } from "../database";
import { searchAlbum } from "../database/queries/album";
import { isLoggedOrGuest, validate } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const search = z.object({ query: z.string().min(3).max(64) });

router.get("/:query", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { query } = validate(req.params, search);

  const [artists, tracks, albums] = await Promise.all([
    searchArtist(user, query),
    searchTrack(query),
    searchAlbum(query),
  ]);
  res.status(200).send({ artists, tracks, albums });
});
