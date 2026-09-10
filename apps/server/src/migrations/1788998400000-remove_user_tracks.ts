import { UserModel } from "../database/Models";
import { startMigration } from "../tools/migrations";

export async function up() {
  startMigration("remove the unused listen ids stored on users");

  // Through the driver, the field left the schema so Mongoose would strip it
  // from the update. It grew with every listen and was never read.
  await UserModel.collection.updateMany(
    { tracks: { $exists: true } },
    { $unset: { tracks: "" } },
  );
}

export async function down() {}
