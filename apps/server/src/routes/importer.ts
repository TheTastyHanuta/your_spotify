import { unlink } from "fs/promises";

import { Request, Response, Router } from "express";
import multer from "multer";
import { z } from "zod";

import {
  getImporterState,
  getUserImporterState,
} from "../database/queries/importer";
import {
  canUserImport,
  cleanupImport,
  runImporter,
} from "../tools/importers/importer";
import { ImporterStateType } from "../tools/importers/types";
import { logger } from "../tools/logger";
import { logged, notAlreadyImporting, validate } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const upload = multer({
  dest: "/tmp/imports/",
  limits: {
    files: 50,
    fileSize: 1024 * 1024 * 20, // 20 mo
  },
});

const removeUploads = (files: Express.Multer.File[]) =>
  Promise.all(files.map((file) => unlink(file.path)));

// A started import deletes its uploads when it succeeds and keeps them for a
// retry when it fails. Uploads of an import that never started are deleted
// here, nothing would reference them afterwards.
const importUploadedFiles =
  (type: "privacy" | "full-privacy") => async (req: Request, res: Response) => {
    const { user } = req as LoggedRequest;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files) {
      res.status(400).end();
      return;
    }

    if (!canUserImport(user._id.toString())) {
      removeUploads(files).catch(logger.error);
      res.status(400).send({ code: "ALREADY_IMPORTING" });
      return;
    }

    runImporter(
      null,
      type,
      user._id.toString(),
      files.map((f) => f.path),
      (success) => {
        if (success) {
          res.status(200).send({ code: "IMPORT_STARTED" });
          return;
        }
        removeUploads(files).catch(logger.error);
        res.status(400).send({ code: "IMPORT_INIT_FAILED" });
      },
    ).catch(logger.error);
  };

router.post(
  "/import/privacy",
  logged,
  notAlreadyImporting,
  upload.array("imports", 50),
  importUploadedFiles("privacy"),
);

router.post(
  "/import/full-privacy",
  logged,
  notAlreadyImporting,
  upload.array("imports", 50),
  importUploadedFiles("full-privacy"),
);

const retrySchema = z.object({ existingStateId: z.string() });

router.post("/import/retry", logged, notAlreadyImporting, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { existingStateId } = validate(req.body, retrySchema);

  const importState =
    await getImporterState<ImporterStateType>(existingStateId);
  if (!importState || importState.user.toString() !== user._id.toString()) {
    res.status(404).end();
    return;
  }

  if (importState.status !== "failure") {
    res.status(400).end();
    return;
  }

  runImporter(
    importState._id.toString(),
    importState.type,
    user._id.toString(),
    importState.metadata,
    (success) => {
      if (success) {
        res.status(200).send({ code: "IMPORT_STARTED" });
        return;
      }
      res.status(400).send({ code: "IMPORT_INIT_FAILED" });
      return;
    },
  ).catch(logger.error);
});

const cleanupImportSchema = z.object({ id: z.string() });

router.delete("/import/clean/:id", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { id } = validate(req.params, cleanupImportSchema);

  const importState = await getImporterState(id);
  if (!importState) {
    res.status(404).end();
    return;
  }
  if (importState.user.toString() !== user._id.toString()) {
    res.status(404).end();
    return;
  }
  await cleanupImport(importState._id.toString());
  res.status(204).end();
});

router.get("/imports", logged, async (req, res) => {
  const { user } = req as LoggedRequest;

  const state = await getUserImporterState(user._id.toString());
  res.status(200).send(state);
});
