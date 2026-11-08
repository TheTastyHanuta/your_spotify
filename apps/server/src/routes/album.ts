import { Router } from "express";
import { z } from "zod";

import { getArtists, getRankOf, ItemType } from "../database";
import {
  getAlbumElsewhere,
  getAlbumSongs,
  getAlbums,
  getFirstAndLastListenedAlbum,
} from "../database/queries/album";
import { fetchAlbumTracklist } from "../tools/albumTracklist";
import { isLoggedOrGuest, validate } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const getAlbumsSchema = z.object({ ids: z.string() });

router.get("/:ids", isLoggedOrGuest, async (req, res) => {
  const { ids } = validate(req.params, getAlbumsSchema);
  const albums = await getAlbums(ids.split(","));
  if (!albums || albums.length === 0) {
    res.status(404).end();
    return;
  }
  res.status(200).send(albums);
});

const getAlbumStats = z.object({ id: z.string() });

router.get("/:id/stats", isLoggedOrGuest, async (req, res) => {
  const { user, isGuest } = req as LoggedRequest;
  const { id } = validate(req.params, getAlbumStats);
  const [album] = await getAlbums([id]);
  if (!album) {
    res.status(404).end();
    return;
  }
  const [firstLast, tracks, artists] = await Promise.all([
    getFirstAndLastListenedAlbum(user, id),
    getAlbumSongs(user, id),
    getArtists(album.artists),
  ]);
  // The client dereferences firstLast unguarded, and search lists albums the
  // user never played, so an empty history has to be reported explicitly.
  if (!firstLast) {
    res.status(200).send({ code: "NEVER_LISTENED" });
    return;
  }
  // The album's tracklist, for its songs only played from other releases, is
  // fetched from Spotify on the first view. Only for the user's own view with
  // a working login: a share link must not spend the owner's requests.
  if (!isGuest && !user.spotifyReauthRequired) {
    await fetchAlbumTracklist(user._id.toString(), id);
  }
  const elsewhere = await getAlbumElsewhere(
    user,
    id,
    tracks.map((song: { _id: string }) => song._id),
  );
  res.status(200).send({ album, artists, firstLast, tracks, ...elsewhere });
});

router.get("/:id/rank", isLoggedOrGuest, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { id } = validate(req.params, getAlbumStats);
  const [album] = await getAlbums([id]);
  if (!album) {
    res.status(404).end();
    return;
  }
  const rank = await getRankOf(ItemType.album, user, id);
  res.status(200).send(rank);
});
