import { api } from "../../../apis/api";
import { myAsyncThunk } from "../../tools";
import { alertMessage } from "../message/reducer";
import { selectImportStates } from "./selector";
import { ImporterState } from "./types";

export const getImports = myAsyncThunk<
  ImporterState[] | null,
  boolean | undefined
>("@import/get", async (force, tapi) => {
  if (!force && selectImportStates(tapi.getState())) {
    return null;
  }
  const { data: imports } = await api.getImports();
  return imports;
});

// The codes the server answers a failed import start with. LIMIT_* come from
// the upload limits: 50 files of 20 MB.
const importErrors: Record<string, string> = {
  ALREADY_IMPORTING: "An import is already running on this account",
  IMPORT_INIT_FAILED:
    "The initialization failed, maybe your files are wrongly formatted",
  LIMIT_FILE_SIZE: "A file is larger than 20 MB",
  LIMIT_FILE_COUNT: "Too many files, upload at most 50",
  LIMIT_UNEXPECTED_FILE: "Too many files, upload at most 50",
};

const importErrorMessage = (e: any) =>
  importErrors[e?.response?.data?.code] ?? "Could not start the import";

export const startImportPrivacy = myAsyncThunk<
  void,
  { files?: FileList; id?: string }
>("@import/privacy-start", async ({ files, id }, tapi) => {
  try {
    if (!id) {
      if (!files) {
        return;
      }
      const filesArray = Array.from(Array(files.length).keys())
        .map((i) => files.item(i))
        .filter((f) => f);
      await api.doImportPrivacy(filesArray as File[]);
    } else {
      await api.retryImport(id);
    }
    tapi.dispatch(getImports(true)).catch(console.error);
    tapi.dispatch(
      alertMessage({
        level: "success",
        message: "Successfully started importing",
      }),
    );
  } catch (e: any) {
    tapi.dispatch(
      alertMessage({ level: "error", message: importErrorMessage(e) }),
    );
    console.error(e);
  }
});

export const startImportFullPrivacy = myAsyncThunk<
  void,
  { files?: FileList; id?: string }
>("@import/full-privacy-start", async ({ files, id }, tapi) => {
  try {
    if (!id) {
      if (!files) {
        return;
      }
      const filesArray = Array.from(Array(files.length).keys())
        .map((i) => files.item(i))
        .filter((f) => f);
      await api.doImportFullPrivacy(filesArray as File[]);
    } else {
      await api.retryImport(id);
    }
    tapi.dispatch(getImports(true)).catch(console.error);
    tapi.dispatch(
      alertMessage({
        level: "success",
        message: "Successfully started importing",
      }),
    );
  } catch (e: any) {
    tapi.dispatch(
      alertMessage({ level: "error", message: importErrorMessage(e) }),
    );
    console.error(e);
  }
});

export const cleanupImport = myAsyncThunk<void, string>(
  "@import/cleanup",
  async (id, tapi) => {
    try {
      await api.cleanupImport(id);
      tapi.dispatch(
        alertMessage({
          level: "success",
          message: "Successfully cleaned up import",
        }),
      );
      tapi.dispatch(getImports(true)).catch(console.error);
    } catch {
      tapi.dispatch(
        alertMessage({
          level: "success",
          message: "Could not clean up your import",
        }),
      );
    }
  },
);
