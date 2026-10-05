import mongoose from "mongoose";

import {
  addTrackIdsToUser,
  storeInUser,
  storeFirstListenedAtIfLess,
} from "../database";
import { TrackModel, AlbumModel, ArtistModel } from "../database/Models";
import { Album, SpotifyAlbum } from "../database/schemas/album";
import { Artist } from "../database/schemas/artist";
import { Infos } from "../database/schemas/info";
import { SpotifyTrack, Track } from "../database/schemas/track";
import { SpotifyAPI } from "../tools/apis/spotifyApi";
import { longWriteDbLock } from "../tools/lock";
import { logger } from "../tools/logger";
import { Metrics } from "../tools/metrics";
import { minOfArray, uniqBy } from "../tools/misc";
import { compact } from "../tools/utils";

interface TracksAlbumsArtistsResult {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  tracksBySpotifyId: Map<string, Track>;
}

interface TrackCanonicalizationResult {
  canonicalIdBySpotifyId: Map<string, string>;
  missingTrackIds: string[];
}

const spotifyTrackToStoredTrack = (track: SpotifyTrack): Track => ({
  ...track,
  album: track.album.id,
  artists: track.artists.map((e) => e.id),
  isrc: track.external_ids?.isrc,
});

const getSpotifyTrackIsrcs = (spotifyTracks: SpotifyTrack[]) => [
  ...new Set(
    spotifyTracks
      .map((track) => track.external_ids?.isrc)
      .filter((isrc): isrc is string => Boolean(isrc)),
  ),
];

const getStoredTracksByIdOrIsrc = (ids: string[], isrcs: string[]) =>
  TrackModel.find({
    $or: [
      { id: { $in: ids } },
      ...(isrcs.length > 0
        ? [{ isrc: { $in: isrcs }, mergedInto: { $exists: false } }]
        : []),
    ],
  });

function canonicalizeSpotifyTracks(
  spotifyTracks: SpotifyTrack[],
  storedTracks: Track[],
): TrackCanonicalizationResult {
  const storedById = new Map(storedTracks.map((track) => [track.id, track]));
  const storedByIsrc = new Map(
    storedTracks
      .filter((track) => track.isrc && !track.mergedInto)
      .map((track) => [track.isrc!, track]),
  );
  const canonicalIdBySpotifyId = new Map<string, string>();
  const pendingCanonicalIdByIsrc = new Map<string, string>();
  const missingTrackIds: string[] = [];

  for (const spotifyTrack of spotifyTracks) {
    const isrc = spotifyTrack.external_ids?.isrc;
    const storedByMatchingIsrc = isrc ? storedByIsrc.get(isrc) : undefined;
    if (storedByMatchingIsrc) {
      canonicalIdBySpotifyId.set(spotifyTrack.id, storedByMatchingIsrc.id);
      continue;
    }

    const storedByMatchingId = storedById.get(spotifyTrack.id);
    if (storedByMatchingId) {
      const canonicalId =
        storedByMatchingId.mergedInto ?? storedByMatchingId.id;
      canonicalIdBySpotifyId.set(spotifyTrack.id, canonicalId);
      if (isrc && !pendingCanonicalIdByIsrc.has(isrc)) {
        pendingCanonicalIdByIsrc.set(isrc, canonicalId);
      }
      continue;
    }

    const pendingCanonicalId = isrc
      ? pendingCanonicalIdByIsrc.get(isrc)
      : undefined;
    if (pendingCanonicalId) {
      canonicalIdBySpotifyId.set(spotifyTrack.id, pendingCanonicalId);
      continue;
    }

    canonicalIdBySpotifyId.set(spotifyTrack.id, spotifyTrack.id);
    missingTrackIds.push(spotifyTrack.id);
    if (isrc) {
      pendingCanonicalIdByIsrc.set(isrc, spotifyTrack.id);
    }
  }

  return { canonicalIdBySpotifyId, missingTrackIds };
}

const findMergedIntoTracks = async (storedTracks: Track[]) => {
  const mergedIntoIds = [
    ...new Set(
      storedTracks
        .map((track) => track.mergedInto)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return mergedIntoIds.length > 0
    ? TrackModel.find({ id: { $in: mergedIntoIds } })
    : [];
};

async function updateExistingTrackIsrcs(
  spotifyTracks: SpotifyTrack[],
  storedTracks: Track[],
  canonicalIdBySpotifyId: Map<string, string>,
) {
  const storedById = new Map(storedTracks.map((track) => [track.id, track]));
  const updates = spotifyTracks.flatMap((track) => {
    const isrc = track.external_ids?.isrc;
    const storedTrack = storedById.get(track.id);
    if (
      !isrc ||
      !storedTrack ||
      storedTrack.mergedInto ||
      storedTrack.isrc === isrc ||
      canonicalIdBySpotifyId.get(track.id) !== track.id
    ) {
      return [];
    }
    return [
      { updateOne: { filter: { id: track.id }, update: { $set: { isrc } } } },
    ];
  });

  if (updates.length === 0) {
    return;
  }

  try {
    await TrackModel.bulkWrite(updates, { ordered: false });
  } catch (error) {
    logger.warn("Could not update ISRCs on existing tracks", error);
  }
}

function mapSpotifyIdsToCanonicalTracks(
  spotifyTracks: SpotifyTrack[],
  canonicalIdBySpotifyId: Map<string, string>,
  tracks: Track[],
) {
  const tracksById = new Map(tracks.map((track) => [track.id, track]));

  return new Map(
    spotifyTracks.flatMap((track) => {
      const canonicalId = canonicalIdBySpotifyId.get(track.id);
      const storedTrack = canonicalId ? tracksById.get(canonicalId) : null;
      return storedTrack ? [[track.id, storedTrack] as const] : [];
    }),
  );
}

const toStoredTracks = (userId: string, spotifyTracks: SpotifyTrack[]) => {
  const tracks = spotifyTracks.map<Track>((track) => {
    logger.info(
      `Storing non existing track ${track.name} by ${track.artists[0]?.name}`,
    );
    return spotifyTrackToStoredTrack(track);
  });
  Metrics.ingestedTracksTotal.inc({ user: userId }, tracks.length);

  return tracks;
};

export const getTracks = async (userId: string, ids: string[]) => {
  const client = new SpotifyAPI(userId);
  return toStoredTracks(userId, compact(await client.getTracks(ids)));
};

// The album inside a track response lacks copyrights and genres, neither is
// read anywhere and Spotify deprecated album genres, so they default to empty.
const toStoredAlbums = (userId: string, spotifyAlbums: SpotifyAlbum[]) => {
  const albums: Album[] = spotifyAlbums.map((alb) => {
    logger.info(
      `Storing non existing album ${alb.name} by ${alb.artists[0]?.name}`,
    );

    return {
      ...alb,
      copyrights: alb.copyrights ?? [],
      genres: alb.genres ?? [],
      artists: alb.artists.map((art) => art.id),
    };
  });
  Metrics.ingestedAlbumsTotal.inc({ user: userId }, albums.length);

  return albums;
};

export const getAlbums = async (userId: string, ids: string[]) => {
  const client = new SpotifyAPI(userId);
  return toStoredAlbums(userId, compact(await client.getAlbums(ids)));
};

// Tracks the importer loads from the database carry only the album id
const isFullAlbum = (album: SpotifyAlbum | undefined): album is SpotifyAlbum =>
  album?.name !== undefined &&
  Array.isArray(album.images) &&
  Array.isArray(album.artists);

// Spotify only needs to be asked for the albums no track brought along
export const splitMissingAlbums = (
  spotifyTracks: SpotifyTrack[],
  missingIds: string[],
) => {
  const embedded = new Map(
    spotifyTracks
      .map((track) => track.album)
      .filter(isFullAlbum)
      .map((album) => [album.id, album]),
  );
  return {
    embedded: compact(missingIds.map((id) => embedded.get(id))),
    toFetch: missingIds.filter((id) => !embedded.has(id)),
  };
};

// What the importers need from a track already stored, so it does not have to
// be requested from Spotify again. Its album and artists only hold their ids.
export const storedTrackToSpotifyTrack = (track: Track): SpotifyTrack => ({
  ...track,
  album: { id: track.album } as SpotifyAlbum,
  artists: track.artists.map((id) => ({ id }) as Artist),
  external_ids: track.isrc ? { isrc: track.isrc } : {},
});

// Stored tracks without an ISRC are left out, fetching them again is what
// fills in their ISRC. Merged tracks have theirs removed on purpose.
export const getReusableStoredTracks = async (ids: string[]) => {
  const tracks: Track[] = await TrackModel.find({
    id: { $in: ids },
    $or: [{ isrc: { $ne: null } }, { mergedInto: { $ne: null } }],
  }).lean();
  return new Map(
    tracks.map((track) => [track.id, storedTrackToSpotifyTrack(track)]),
  );
};

export const getArtists = async (userId: string, ids: string[]) => {
  const client = new SpotifyAPI(userId);
  const spotifyArtists = compact(await client.getArtists(ids));

  for (const spotifyArtist of spotifyArtists) {
    logger.info(`Storing non existing artist ${spotifyArtist.name}`);
  }

  Metrics.ingestedArtistsTotal.inc({ user: userId }, spotifyArtists.length);

  return spotifyArtists;
};

const getTracksAndRelatedAlbumArtists = async (
  userId: string,
  spotifyTracks: SpotifyTrack[],
  ids: string[],
) => {
  // The polling loop and the importers already hold full track objects, and
  // fetching them again doubled the requests of an import. Tracks without
  // external_ids are still fetched, so their ISRC is not lost when a response
  // leaves the field out. Local files go the old way too, Spotify has no
  // track behind them and the lookup drops them.
  const givenById = new Map(
    spotifyTracks
      .filter(
        (track) =>
          track.id && !track.is_local && track.external_ids !== undefined,
      )
      .map((track) => [track.id, track]),
  );
  const uniqueIds = [...new Set(ids)];
  const given = compact(uniqueIds.map((id) => givenById.get(id)));
  const toFetch = uniqueIds.filter((id) => !givenById.has(id));
  const fetched =
    toFetch.length > 0
      ? compact(await new SpotifyAPI(userId).getTracks(toFetch))
      : [];
  const tracks = toStoredTracks(userId, [...given, ...fetched]);

  return {
    tracks,
    fetched,
    artists: [...new Set(tracks.flatMap((e) => e.artists)).values()],
    albums: [...new Set(tracks.map((e) => e.album)).values()],
  };
};

const getSourceAlbumArtistIds = (spotifyTracks: SpotifyTrack[]) => ({
  artists: [
    ...new Set(
      spotifyTracks
        .flatMap((track) => track.artists.map((artist) => artist.id))
        .filter(Boolean),
    ),
  ],
  albums: [
    ...new Set(spotifyTracks.map((track) => track.album.id).filter(Boolean)),
  ],
});

export const getTracksAlbumsArtists = async (
  userId: string,
  spotifyTracks: SpotifyTrack[],
): Promise<TracksAlbumsArtistsResult> => {
  if (spotifyTracks.length === 0) {
    return {
      tracks: [],
      albums: [],
      artists: [],
      tracksBySpotifyId: new Map<string, Track>(),
    };
  }

  const ids = spotifyTracks.map((track) => track.id);
  const isrcs = getSpotifyTrackIsrcs(spotifyTracks);
  const storedTracks: Track[] = await getStoredTracksByIdOrIsrc(ids, isrcs);
  const { canonicalIdBySpotifyId, missingTrackIds } = canonicalizeSpotifyTracks(
    spotifyTracks,
    storedTracks,
  );
  const mergedIntoTracks: Track[] = await findMergedIntoTracks(storedTracks);

  await updateExistingTrackIsrcs(
    spotifyTracks,
    storedTracks,
    canonicalIdBySpotifyId,
  );

  const {
    tracks,
    fetched,
    artists: relatedArtists,
    albums: relatedAlbums,
  } = missingTrackIds.length > 0
    ? await getTracksAndRelatedAlbumArtists(
        userId,
        spotifyTracks,
        missingTrackIds,
      )
    : { tracks: [], fetched: [], artists: [], albums: [] };
  if (missingTrackIds.length === 0) {
    logger.info("No missing tracks, passing...");
  }
  const sourceRelated = getSourceAlbumArtistIds(spotifyTracks);
  const allRelatedAlbums = [
    ...new Set([...relatedAlbums, ...sourceRelated.albums]),
  ];
  const allRelatedArtists = [
    ...new Set([...relatedArtists, ...sourceRelated.artists]),
  ];

  const storedAlbums: Album[] = await AlbumModel.find({
    id: { $in: allRelatedAlbums },
  });
  const missingAlbumIds = allRelatedAlbums.filter(
    (alb) =>
      !storedAlbums.find((salb) => salb.id.toString() === alb.toString()),
  );

  const storedArtists: Artist[] = await ArtistModel.find({
    id: { $in: allRelatedArtists },
  });
  const missingArtistIds = allRelatedArtists.filter(
    (alb) =>
      !storedArtists.find((salb) => salb.id.toString() === alb.toString()),
  );

  const { embedded, toFetch } = splitMissingAlbums(
    [...spotifyTracks, ...fetched],
    missingAlbumIds,
  );
  const albums = [
    ...toStoredAlbums(userId, embedded),
    ...(toFetch.length > 0 ? await getAlbums(userId, toFetch) : []),
  ];
  const artists =
    missingArtistIds.length > 0
      ? await getArtists(userId, missingArtistIds)
      : [];

  return {
    tracks,
    albums,
    artists,
    tracksBySpotifyId: mapSpotifyIdsToCanonicalTracks(
      spotifyTracks,
      canonicalIdBySpotifyId,
      [...storedTracks, ...mergedIntoTracks, ...tracks],
    ),
  };
};

// Upserts, because an import and the polling loop can both find the same
// item missing and fetch it, and a plain insert of the second copy would fail
// on the unique id index.
async function upsertById(model: mongoose.Model<any>, items: { id: string }[]) {
  const uniqueItems = uniqBy(items, (item) => item.id);
  if (uniqueItems.length === 0) {
    return;
  }
  await model.bulkWrite(
    uniqueItems.map((item) => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: item },
        upsert: true,
      },
    })),
  );
}

export async function storeTrackAlbumArtist({
  tracks,
  albums,
  artists,
}: {
  tracks?: Track[];
  albums?: Album[];
  artists?: Artist[];
}) {
  await upsertById(TrackModel, tracks ?? []);
  await upsertById(AlbumModel, albums ?? []);
  await upsertById(ArtistModel, artists ?? []);
}

export async function storeIterationOfLoop(
  userId: string,
  iterationTimestamp: number,
  tracks: Track[],
  albums: Album[],
  artists: Artist[],
  infos: Omit<Infos, "owner">[],
) {
  await longWriteDbLock.lock();

  try {
    await storeTrackAlbumArtist({ tracks, albums, artists });

    await addTrackIdsToUser(userId, infos);

    await storeInUser("_id", new mongoose.Types.ObjectId(userId), {
      lastTimestamp: iterationTimestamp,
    });

    const min = minOfArray(infos, (item) => item.played_at.getTime());

    if (min) {
      const minInfo = infos[min.minIndex]?.played_at;
      if (minInfo) {
        await storeFirstListenedAtIfLess(userId, minInfo);
      }
    }
  } finally {
    longWriteDbLock.unlock();
  }
}
