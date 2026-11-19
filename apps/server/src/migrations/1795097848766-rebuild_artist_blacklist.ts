import { checkBlacklistConsistency, getAllUsers } from "../database";
import { InfosModel } from "../database/Models";
import { startMigration } from "../tools/migrations";

export async function up() {
  startMigration(
    "mark blacklisted artists by each listen's own primary artist",
  );

  // Blacklisting used to go through the track's first artist, which after an
  // ISRC merge can differ from the listen's, and imports never marked
  // listens. Unblacklisting now matches primaryArtistId, so the old marks are
  // rebuilt from each user's blacklist the same way.
  const users = await getAllUsers(false);
  for (const user of users) {
    const blacklisted = user.settings?.blacklistedArtists ?? [];
    await InfosModel.updateMany(
      {
        owner: user._id,
        blacklistedBy: "artist",
        primaryArtistId: { $nin: blacklisted },
      },
      { $pull: { blacklistedBy: "artist" } },
    );
    if (blacklisted.length > 0) {
      await InfosModel.updateMany(
        { owner: user._id, primaryArtistId: { $in: blacklisted } },
        { $addToSet: { blacklistedBy: "artist" } },
      );
    }
  }
  await checkBlacklistConsistency();
}

export async function down() {}
