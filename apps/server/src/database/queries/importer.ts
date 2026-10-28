import {
  ImporterState,
  ImporterStateFromType,
  ImporterStateStatus,
  ImporterStateType,
} from "../../tools/importers/types";
import { ImporterStateModel } from "../Models";

export const createImporterState = (
  userId: string,
  state: Omit<ImporterState, "_id" | "user">,
) =>
  ImporterStateModel.create({ user: userId, ...state } as Omit<
    ImporterState,
    "_id" | "user"
  >);

// Any status change clears the ban end of an earlier pause
export const setImporterStateStatus = (
  id: string,
  status: ImporterStateStatus,
) =>
  ImporterStateModel.findByIdAndUpdate(id, {
    $set: { status },
    $unset: { rateLimitedUntil: 1 },
  });

// Changes the status only if it still is one of from, and returns the import
// as it was, or null. The resume timer and a cancel both claim a waiting
// import this way, so only one of them goes ahead.
export const claimImporterState = (
  id: string,
  from: ImporterStateStatus[],
  status: ImporterStateStatus,
) =>
  ImporterStateModel.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { $set: { status }, $unset: { rateLimitedUntil: 1 } },
  );

export const setImporterStateWaiting = (
  id: string,
  rateLimitedUntil: Date,
  slowdownMs: number,
) =>
  ImporterStateModel.findByIdAndUpdate(id, {
    $set: { status: "waiting", rateLimitedUntil, slowdownMs },
  });

export const getImporterState = <T extends ImporterStateType>(id: string) =>
  ImporterStateModel.findById<ImporterStateFromType<T>>(id);

export const setImporterStateMetadata = <T extends ImporterState["metadata"]>(
  id: string,
  metadata: T,
) =>
  ImporterStateModel.findByIdAndUpdate(
    id,
    { metadata },
    { returnDocument: "after" },
  );

export const setImporterStateCurrent = (id: string, current: number) =>
  ImporterStateModel.findByIdAndUpdate(id, { current });

export const getUserImporterState = async (userId: string) =>
  ImporterStateModel.find({ user: userId }).sort({ createdAt: -1 });

// Imports that were running when the server stopped wait like a paused one
export const getImportsToResumeAtStart = async () => {
  await ImporterStateModel.updateMany(
    { status: "progress" },
    { status: "waiting" },
  );
  return ImporterStateModel.find({ status: "waiting" });
};
