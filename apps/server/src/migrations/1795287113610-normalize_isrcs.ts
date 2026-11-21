import {
  AlbumTracklistModel,
  IsrcLookupModel,
  TrackModel,
} from "../database/Models";
import { storeIsrcLookup } from "../database/queries/isrcMerge";
import { normalizeIsrc, planIsrcNormalization } from "../tools/isrc";
import { logger } from "../tools/logger";
import { startMigration } from "../tools/migrations";

// Empty, or anything but uppercase letters and digits
const oddIsrc = { $regex: /^$|[^A-Z0-9]/ };
const active = { mergedInto: { $exists: false } };

export async function up() {
  startMigration("normalize the spelling of ISRCs");

  // Merged versions have no ISRC, it would block their primary's: only
  // active tracks may keep one
  await TrackModel.updateMany(
    { mergedInto: { $exists: true }, isrc: { $exists: true } },
    { $unset: { isrc: "" } },
  );

  const odd = await TrackModel.find(
    { ...active, isrc: oddIsrc },
    { id: 1, isrc: 1 },
  )
    .lean()
    .then((tracks) => tracks.map(({ id, isrc }) => ({ id, isrc: isrc! })));
  const twins = await TrackModel.find(
    {
      ...active,
      isrc: {
        $in: [...new Set(odd.map(({ isrc }) => normalizeIsrc(isrc) ?? ""))],
      },
    },
    { id: 1, isrc: 1 },
  ).lean();
  const { rewrite, toLookUp } = planIsrcNormalization([
    ...odd,
    ...twins.map(({ id, isrc }) => ({ id, isrc: isrc! })),
  ]);
  // Lookup first, so a crash in between leaves the track odd for the rerun.
  // Unset before the rewrites: the index is unique.
  for (const { id, isrc } of toLookUp) {
    await storeIsrcLookup(id, isrc);
    await TrackModel.updateOne({ id }, { $unset: { isrc: "" } });
  }
  for (const { id, isrc } of rewrite) {
    await TrackModel.updateOne({ id }, { $set: { isrc } });
  }

  const lookups = await IsrcLookupModel.find(
    { isrc: oddIsrc },
    { isrc: 1 },
  ).lean();
  for (const lookup of lookups) {
    await IsrcLookupModel.updateOne(
      { _id: lookup._id },
      { $set: { isrc: normalizeIsrc(lookup.isrc) ?? null } },
    );
  }

  const tracklists = await AlbumTracklistModel.find(
    { "entries.isrc": oddIsrc },
    { entries: 1 },
  ).lean();
  for (const tracklist of tracklists) {
    await AlbumTracklistModel.updateOne(
      { _id: tracklist._id },
      {
        $set: {
          entries: tracklist.entries.map((entry) =>
            entry.isrc
              ? { ...entry, isrc: normalizeIsrc(entry.isrc) ?? null }
              : entry,
          ),
        },
      },
    );
  }

  logger.info(
    `Normalized ${odd.length} track ISRCs; ${toLookUp.length} tracks share their recording with another one and are listed on the ISRC merge page`,
  );
}

export async function down() {}
