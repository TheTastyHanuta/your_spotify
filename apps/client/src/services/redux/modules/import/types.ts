export type ImporterStateStatus =
  | "progress"
  | "success"
  | "failure"
  | "failure-removed"
  // Paused while Spotify blocks the requests, resumes on its own
  | "waiting";

export enum ImporterStateType {
  privacy = "privacy",
  fullPrivacy = "full-privacy",
}

export interface BaseImporterState {
  _id: string;
  createdAt: string;
  user: string;
  type: string;
  current: number;
  total: number;
  status: ImporterStateStatus;
  // Set while the import waits for Spotify to stop blocking the requests
  rateLimitedUntil?: string;
}

export interface PrivacyImporterState extends BaseImporterState {
  type: ImporterStateType.privacy;
  metadata: string[];
}

export interface FullPrivacyImporterState extends BaseImporterState {
  type: ImporterStateType.fullPrivacy;
  metadata: string[];
}

export type ImporterState = PrivacyImporterState;
