import {
  deleteAllInfosFromUserId,
  deleteAllOrphanTracks,
  deleteUser as dbDeleteUser,
} from "../database";
import { longWriteDbLock } from "./lock";
import { logger } from "./logger";

export const deleteUser = async (userId: string) => {
  logger.info(`Deleting user ${userId}`);
  await longWriteDbLock.lock();
  try {
    await deleteAllInfosFromUserId(userId);
    await dbDeleteUser(userId);
    await deleteAllOrphanTracks();
  } finally {
    // The polling loop waits on this lock, leaving it held stops tracking
    longWriteDbLock.unlock();
  }
};
