import { Types } from "mongoose";

export interface HistoryImporter<T extends ImporterStateType> {
  init: (
    existingState: ImporterStateFromType<T> | null,
    requiredData: ImporterStateFromType<T>["metadata"],
  ) => Promise<{ total: number } | null>;
  run: (id: string) => Promise<boolean>;
  cleanup: (
    requiredData: ImporterStateFromType<T>["metadata"],
  ) => Promise<void>;
}

export type ImporterStateStatus =
  | "progress"
  | "success"
  | "failure"
  | "failure-removed"
  // Paused while Spotify blocks the requests, resumes on its own
  | "waiting";

export interface BaseImporterState {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: string;
  current: number;
  total: number;
  status: ImporterStateStatus;
  // Set while the import waits for Spotify to stop blocking the requests
  rateLimitedUntil?: Date;
  // Extra wait before each Spotify request, raised after every ban
  slowdownMs?: number;
}
export interface PrivacyImporterState extends BaseImporterState {
  type: "privacy";
  metadata: string[];
}

export interface FullPrivacyImporterState extends BaseImporterState {
  type: "full-privacy";
  metadata: string[];
}

export type ImporterState = PrivacyImporterState | FullPrivacyImporterState;
export type ImporterStateType = ImporterState["type"];

export type ImporterStateFromType<T extends ImporterStateType> = Extract<
  ImporterState,
  { type: T }
>;
