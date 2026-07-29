import { startServer } from "./bin/www";
import { runMigrations } from "./migrations";
import { runMergeTracksByIsrcCli } from "./migrations/mergeTracksByIsrc";

if (process.argv[2] === "--migrate") {
  runMigrations();
} else if (process.argv[2] === "--merge-tracks-by-isrc") {
  void runMergeTracksByIsrcCli(process.argv.slice(3));
} else {
  startServer();
}
