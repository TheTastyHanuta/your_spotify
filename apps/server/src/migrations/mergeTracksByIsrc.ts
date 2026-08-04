import { appendFile, mkdir, writeFile } from "fs/promises";
import { dirname } from "path";

import Axios from "axios";
import mongoose, { HydratedDocument, Types } from "mongoose";

import { InfosModel, TrackModel } from "../database/Models";
import { Track } from "../database/schemas/track";
import { chunk } from "../tools/misc";
import { credentials } from "../tools/oauth/credentials";

const DEFAULT_MONGO_ENDPOINT = "mongodb://mongo:27017/your_spotify";
const UPDATE_BATCH_SIZE = 1000;
const SPOTIFY_FETCH_BATCH_SIZE = 50;
const MAX_REPOINT_PASSES = 10;

type TrackDocument = HydratedDocument<Track>;

interface PlayCount {
  _id: string;
  count: number;
}

interface SpotifyCatalogTrack {
  id: string;
  external_ids?: { isrc?: string };
}

interface MergeTracksByIsrcOptions {
  dryRun?: boolean;
  reportPath?: string;
}

export interface MergeTracksByIsrcSummary {
  dryRun: boolean;
  duplicateIsrcs: number;
  redundantTracks: number;
  infosUpdated: number;
  tracksMarkedMerged: number;
  strayListensRepointed: number;
  elapsedMs: number;
  reportPath: string;
}

export function getDryRunMode(args = process.argv.slice(2), env = process.env) {
  if (args.includes("--dry-run") || env.DRY_RUN === "true") {
    return true;
  }
  if (args.includes("--apply") || env.DRY_RUN === "false") {
    return false;
  }
  return true;
}

export function getReportPath(args = process.argv.slice(2), env = process.env) {
  const reportArg = args.find((arg) => arg.startsWith("--report="));
  if (reportArg) {
    return reportArg.slice("--report=".length);
  }
  if (env.MERGE_TRACKS_REPORT_PATH) {
    return env.MERGE_TRACKS_REPORT_PATH;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `/tmp/merge-tracks-by-isrc-${timestamp}.md`;
}

class MigrationReport {
  constructor(private readonly path: string) {}

  async init(dryRun: boolean) {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(
      this.path,
      [
        "# ISRC Track Merge Report",
        "",
        `Started: ${new Date().toISOString()}`,
        `Mode: ${dryRun ? "dry-run" : "apply"}`,
        "",
      ].join("\n"),
    );
  }

  async write(message: string) {
    await appendFile(this.path, `${message}\n`);
  }

  async section(title: string) {
    await this.write(`\n## ${title}\n`);
  }
}

function getCreatedAtMs(track: TrackDocument) {
  const id = track._id;
  if (id instanceof Types.ObjectId) {
    return id.getTimestamp().getTime();
  }
  return Number.POSITIVE_INFINITY;
}

function electPrimary(
  tracks: TrackDocument[],
  playCountsByTrackId: Map<string, number>,
) {
  return [...tracks].sort((a, b) => {
    const playCountDiff =
      (playCountsByTrackId.get(b.id) ?? 0) -
      (playCountsByTrackId.get(a.id) ?? 0);
    if (playCountDiff !== 0) {
      return playCountDiff;
    }

    const createdAtDiff = getCreatedAtMs(a) - getCreatedAtMs(b);
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return a.id.localeCompare(b.id);
  })[0];
}

async function getPlayCounts(trackIds: string[]) {
  const counts = await InfosModel.aggregate<PlayCount>([
    { $match: { id: { $in: trackIds } } },
    { $group: { _id: "$id", count: { $sum: 1 } } },
  ]);
  return new Map(counts.map((item) => [item._id, item.count]));
}

async function getSpotifyCatalogAccessToken() {
  const { data } = await Axios.post(
    "https://accounts.spotify.com/api/token",
    null,
    {
      params: { grant_type: "client_credentials" },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${credentials.spotify.public}:${credentials.spotify.secret}`,
        ).toString("base64")}`,
      },
    },
  );

  return data.access_token as string;
}

async function fetchSpotifyTracks(trackIds: string[], accessToken: string) {
  try {
    const { data } = await Axios.get<{
      tracks: (SpotifyCatalogTrack | null)[];
    }>("https://api.spotify.com/v1/tracks", {
      params: { ids: trackIds.join(",") },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return data.tracks;
  } catch {
    const tracks: (SpotifyCatalogTrack | null)[] = [];
    for (const trackId of trackIds) {
      try {
        const { data } = await Axios.get<SpotifyCatalogTrack>(
          `https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        tracks.push(data);
      } catch {
        tracks.push(null);
      }
    }
    return tracks;
  }
}

async function backfillMissingIsrcs() {
  const tracksMissingIsrc = await TrackModel.find({
    mergedInto: { $exists: false },
    $or: [{ isrc: { $exists: false } }, { isrc: null }, { isrc: "" }],
  });

  if (tracksMissingIsrc.length === 0) {
    console.log("Step 2a: no tracks need ISRC backfill");
    return { tracks: [] as TrackDocument[], backfilledCount: 0 };
  }

  const accessToken = await getSpotifyCatalogAccessToken();

  console.log(
    `Step 2a: fetching ISRCs from Spotify for ${tracksMissingIsrc.length} tracks for grouping`,
  );

  let backfilledCount = 0;
  let processedCount = 0;
  for (const trackBatch of chunk(tracksMissingIsrc, SPOTIFY_FETCH_BATCH_SIZE)) {
    const spotifyTracks = await fetchSpotifyTracks(
      trackBatch.map((track) => track.id),
      accessToken,
    );
    const isrcByTrackId = new Map(
      spotifyTracks.flatMap((spotifyTrack) => {
        const isrc = spotifyTrack?.external_ids?.isrc;
        return spotifyTrack && isrc ? [[spotifyTrack.id, isrc] as const] : [];
      }),
    );

    for (const track of trackBatch) {
      const isrc = isrcByTrackId.get(track.id);
      if (!isrc) {
        continue;
      }
      track.isrc = isrc;
      backfilledCount += 1;
    }

    processedCount += trackBatch.length;
    console.log(
      `Step 2a: checked ${processedCount}/${tracksMissingIsrc.length} tracks, found ${backfilledCount} ISRCs`,
    );
  }

  return { tracks: tracksMissingIsrc, backfilledCount };
}

// The polling loop and the importers resolve a track id before they write the
// listen. A listen resolved just before its track was marked as merged can land
// on that secondary track after the migration already re-pointed its listens,
// and the main scan can never find it again because it skips merged tracks.
// Sweeping every merged track at the end catches those, which also means that
// running the migration again repairs a database where it already happened.
async function getSecondaryIdsByPrimaryId() {
  const mergedTracks = await TrackModel.find({
    mergedInto: { $exists: true, $ne: null },
  });

  const secondaryIdsByPrimaryId = new Map<string, string[]>();
  for (const track of mergedTracks) {
    if (!track.mergedInto) {
      continue;
    }
    const group = secondaryIdsByPrimaryId.get(track.mergedInto) ?? [];
    group.push(track.id);
    secondaryIdsByPrimaryId.set(track.mergedInto, group);
  }
  return secondaryIdsByPrimaryId;
}

async function countListensOnMergedTracks() {
  const secondaryIdsByPrimaryId = await getSecondaryIdsByPrimaryId();

  let total = 0;
  for (const secondaryIds of secondaryIdsByPrimaryId.values()) {
    for (const secondaryIdBatch of chunk(secondaryIds, UPDATE_BATCH_SIZE)) {
      total += await InfosModel.countDocuments({
        id: { $in: secondaryIdBatch },
      });
    }
  }
  return total;
}

async function repointListensOnMergedTracks() {
  let repointed = 0;
  for (let pass = 0; pass < MAX_REPOINT_PASSES; pass += 1) {
    const secondaryIdsByPrimaryId = await getSecondaryIdsByPrimaryId();

    let repointedInPass = 0;
    for (const [primaryId, secondaryIds] of secondaryIdsByPrimaryId) {
      for (const secondaryIdBatch of chunk(secondaryIds, UPDATE_BATCH_SIZE)) {
        const update = await InfosModel.updateMany(
          { id: { $in: secondaryIdBatch } },
          { $set: { id: primaryId } },
        );
        repointedInPass += update.modifiedCount;
      }
    }

    repointed += repointedInPass;
    if (repointedInPass === 0) {
      return { repointed, incomplete: false };
    }
  }
  // A secondary pointing at another merged track resolves on the next pass, so
  // only a cycle in mergedInto can use up every pass.
  return { repointed, incomplete: true };
}

async function writeExistingMergeAudit(report: MigrationReport) {
  const mergedTracks = await TrackModel.find({
    mergedInto: { $exists: true, $ne: null },
  }).sort({ mergedInto: 1, id: 1 });

  await report.section("Merged Tracks Audit");
  if (mergedTracks.length === 0) {
    await report.write("No tracks are currently marked as merged.");
    return 0;
  }

  const primaryIds = [
    ...new Set(
      mergedTracks
        .map((track) => track.mergedInto)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const primaryTracks = await TrackModel.find({ id: { $in: primaryIds } });
  const primaryById = new Map(primaryTracks.map((track) => [track.id, track]));
  const mergedByPrimaryId = new Map<string, TrackDocument[]>();

  for (const track of mergedTracks) {
    if (!track.mergedInto) {
      continue;
    }
    const group = mergedByPrimaryId.get(track.mergedInto) ?? [];
    group.push(track);
    mergedByPrimaryId.set(track.mergedInto, group);
  }

  for (const [primaryId, secondaries] of mergedByPrimaryId) {
    const primary = primaryById.get(primaryId);
    await report.write(
      `### ${primaryId}${primary ? ` | ${primary.name}` : " | missing primary track"}`,
    );
    for (const secondary of secondaries) {
      await report.write(`- ${secondary.id} | ${secondary.name}`);
    }
    await report.write("");
  }

  return mergedTracks.length;
}

async function writeMergeReportGroup(
  report: MigrationReport,
  isrc: string,
  primary: TrackDocument,
  secondaries: TrackDocument[],
  playCountsByTrackId: Map<string, number>,
) {
  await report.write(`### ISRC ${isrc}`);
  await report.write(
    `Primary: ${primary.id} | ${primary.name} | ${
      playCountsByTrackId.get(primary.id) ?? 0
    } plays`,
  );
  await report.write("Secondaries:");
  for (const secondary of secondaries) {
    await report.write(
      `- ${secondary.id} | ${secondary.name} | ${
        playCountsByTrackId.get(secondary.id) ?? 0
      } plays`,
    );
  }
}

export async function mergeTracksByIsrc({
  dryRun = true,
  reportPath = getReportPath(),
}: MergeTracksByIsrcOptions = {}) {
  const startedAt = Date.now();
  const report = new MigrationReport(reportPath);
  await report.init(dryRun);
  console.log(
    `Step 1: running in ${dryRun ? "dry-run" : "apply"} mode${
      dryRun ? " (pass --apply or DRY_RUN=false to write changes)" : ""
    }`,
  );
  console.log(`Writing merge report to ${reportPath}`);
  await report.write(`Step 1: running in ${dryRun ? "dry-run" : "apply"} mode`);

  console.log("Step 2: loading tracks with ISRCs");
  const backfill = await backfillMissingIsrcs();
  const tracksWithStoredIsrc = await TrackModel.find({
    isrc: { $exists: true, $ne: null },
    mergedInto: { $exists: false },
  });
  const tracks =
    backfill.tracks.length > 0
      ? [
          ...tracksWithStoredIsrc,
          ...backfill.tracks.filter((track) => Boolean(track.isrc)),
        ]
      : tracksWithStoredIsrc;

  console.log("Step 3: grouping tracks by ISRC");
  const tracksByIsrc = new Map<string, TrackDocument[]>();
  for (const track of tracks) {
    if (!track.isrc) {
      continue;
    }
    const group = tracksByIsrc.get(track.isrc) ?? [];
    group.push(track);
    tracksByIsrc.set(track.isrc, group);
  }
  const duplicateGroups = [...tracksByIsrc.entries()].filter(
    ([, group]) => group.length > 1,
  );
  const redundantTracks = duplicateGroups.reduce(
    (total, [, group]) => total + group.length - 1,
    0,
  );
  console.log(
    `Found ${duplicateGroups.length} unique ISRCs with duplicates, ${redundantTracks} total redundant track documents`,
  );
  await report.write(`Total ISRCs backfilled: ${backfill.backfilledCount}`);
  await report.write(
    `Found ${duplicateGroups.length} unique ISRCs with duplicates, ${redundantTracks} total redundant track documents`,
  );
  await report.section("Duplicate Groups");

  const duplicateTrackIds = new Set(
    duplicateGroups.flatMap(([, group]) => group.map((track) => track.id)),
  );
  const uniqueBackfilledTracks = backfill.tracks.filter(
    (track) => track.isrc && !duplicateTrackIds.has(track.id),
  );
  if (!dryRun && uniqueBackfilledTracks.length > 0) {
    await TrackModel.bulkWrite(
      uniqueBackfilledTracks.map((track) => ({
        updateOne: {
          filter: { id: track.id, mergedInto: { $exists: false } },
          update: { $set: { isrc: track.isrc } },
        },
      })),
      { ordered: false },
    );
    console.log(
      `Stored ISRCs on ${uniqueBackfilledTracks.length} non-duplicate tracks`,
    );
  }

  let infosUpdated = 0;
  let tracksMarkedMerged = 0;

  for (const [isrc, group] of duplicateGroups) {
    const trackIds = group.map((track) => track.id);
    const playCountsByTrackId = await getPlayCounts(trackIds);
    const primary = electPrimary(group, playCountsByTrackId);
    if (!primary) {
      continue;
    }
    const secondaries = group.filter((track) => track.id !== primary.id);
    const secondarySummary = secondaries
      .map(
        (track) =>
          `${track.id} (${playCountsByTrackId.get(track.id) ?? 0} plays)`,
      )
      .join(", ");

    console.log(
      `ISRC ${isrc}: primary=${primary.id} (${primary.name}, ${
        playCountsByTrackId.get(primary.id) ?? 0
      } plays), merging ${secondarySummary}`,
    );
    await writeMergeReportGroup(
      report,
      isrc,
      primary,
      secondaries,
      playCountsByTrackId,
    );

    if (dryRun) {
      await report.write("Action: dry-run only, no database writes");
      await report.write("");
      continue;
    }

    let groupInfosUpdated = 0;
    let groupTracksMarkedMerged = 0;
    for (const secondaryIdBatch of chunk(
      secondaries.map((track) => track.id),
      UPDATE_BATCH_SIZE,
    )) {
      const infoUpdate = await InfosModel.updateMany(
        { id: { $in: secondaryIdBatch } },
        { $set: { id: primary.id } },
      );
      groupInfosUpdated += infoUpdate.modifiedCount;

      const trackUpdate = await TrackModel.updateMany(
        { id: { $in: secondaryIdBatch }, mergedInto: { $exists: false } },
        { $set: { mergedInto: primary.id }, $unset: { isrc: "" } },
      );
      groupTracksMarkedMerged += trackUpdate.modifiedCount;
    }
    await TrackModel.updateOne(
      { id: primary.id, mergedInto: { $exists: false } },
      { $set: { isrc } },
    );
    infosUpdated += groupInfosUpdated;
    tracksMarkedMerged += groupTracksMarkedMerged;
    console.log(
      `Updated ${groupInfosUpdated} listen records; marked ${groupTracksMarkedMerged} secondary tracks as merged`,
    );
    await report.write(`Listen records re-pointed: ${groupInfosUpdated}`);
    await report.write(
      `Secondary tracks marked as merged: ${groupTracksMarkedMerged}`,
    );
    await report.write("");
  }

  console.log("Step 4: checking for listens left on merged tracks");
  await report.section("Listens Left On Merged Tracks");
  let strayListensRepointed = 0;
  if (dryRun) {
    const strays = await countListensOnMergedTracks();
    console.log(`${strays} listen records are still attached to merged tracks`);
    await report.write(
      `Listen records still attached to merged tracks: ${strays}`,
    );
    await report.write("Action: dry-run only, no database writes");
  } else {
    const { repointed, incomplete } = await repointListensOnMergedTracks();
    strayListensRepointed = repointed;
    console.log(`Re-pointed ${repointed} listen records left on merged tracks`);
    await report.write(
      `Listen records re-pointed from merged tracks: ${repointed}`,
    );
    if (incomplete) {
      const warning = `Stopped after ${MAX_REPOINT_PASSES} passes, check mergedInto for a cycle`;
      console.warn(warning);
      await report.write(warning);
    }
  }

  const mergedAuditCount = await writeExistingMergeAudit(report);
  const elapsedMs = Date.now() - startedAt;
  const summary: MergeTracksByIsrcSummary = {
    dryRun,
    duplicateIsrcs: duplicateGroups.length,
    redundantTracks,
    infosUpdated,
    tracksMarkedMerged,
    strayListensRepointed,
    elapsedMs,
    reportPath,
  };

  await report.section("Final Summary");
  await report.write(`Total ISRCs backfilled: ${backfill.backfilledCount}`);
  await report.write(`Total ISRCs processed: ${summary.duplicateIsrcs}`);
  await report.write(
    `Total listen records re-pointed: ${summary.infosUpdated}`,
  );
  await report.write(
    `Total secondary tracks marked as merged: ${summary.tracksMarkedMerged}`,
  );
  await report.write(
    `Total listens re-pointed from merged tracks: ${summary.strayListensRepointed}`,
  );
  await report.write(
    `Total currently merged secondary tracks: ${mergedAuditCount}`,
  );
  await report.write(`Elapsed time: ${summary.elapsedMs}ms`);
  await report.write(`Finished: ${new Date().toISOString()}`);

  console.log("Step 7: final summary");
  console.log(`Total ISRCs backfilled: ${backfill.backfilledCount}`);
  console.log(`Total ISRCs processed: ${summary.duplicateIsrcs}`);
  console.log(`Total listen records re-pointed: ${summary.infosUpdated}`);
  console.log(
    `Total secondary tracks marked as merged: ${summary.tracksMarkedMerged}`,
  );
  console.log(
    `Total listens re-pointed from merged tracks: ${summary.strayListensRepointed}`,
  );
  console.log(`Total currently merged secondary tracks: ${mergedAuditCount}`);
  console.log(`Elapsed time: ${summary.elapsedMs}ms`);
  console.log(`Report written to: ${summary.reportPath}`);

  return summary;
}

export async function runMergeTracksByIsrcCli(args = process.argv.slice(2)) {
  const dryRun = getDryRunMode(args);
  const reportPath = getReportPath(args);
  const endpoint = process.env.MONGO_ENDPOINT ?? DEFAULT_MONGO_ENDPOINT;

  try {
    console.log(`Connecting to MongoDB at ${endpoint}`);
    await mongoose.connect(endpoint);
    await mergeTracksByIsrc({ dryRun, reportPath });
  } catch (error) {
    console.error("Failed to merge tracks by ISRC", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}
