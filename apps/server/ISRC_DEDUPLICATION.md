# ISRC Track Deduplication Migration Guide

Spotify can assign multiple track IDs to the same recording when a song appears
on different releases, such as a standard album, deluxe edition, single, or
compilation. The original YourSpotify stores listen history by Spotify track ID,
so those versions appear as separate songs in your stats.

This fork stores each track's ISRC, a code that identifies the recording itself.
New listens are matched by it automatically. Your **existing** history is only
cleaned up when you run the migration in this guide yourself. Switching to this
fork does not merge anything on its own.

The migration is optional, but recommended if you already have listening history.

## Overview

1. Back up your database, while still running the original images.
2. Switch to this fork's images.
3. Run a dry run and read the report.
4. Apply the migration.
5. Check the result.

Plan some time: the migration asks Spotify for the ISRC of every track, one at
a time, at roughly 5 tracks per second. A database with 20,000 tracks takes
about an hour for the dry run and another hour for the apply run. The app keeps
running and recording listens the whole time.

## Before You Start

### Service And Container Names

The commands in this guide use Docker Compose with the service names from the
example compose file of both the original project and this fork: `server`,
`mongo` and `web`. Run them from the directory containing your compose file.

If your services are named differently, replace the names in the commands. To
list your service names:

```bash
docker compose config --services
```

If you do not use Docker Compose (plain `docker run`, a NAS web interface,
etc.), find your container names with:

```bash
docker ps --format '{{.Names}}\t{{.Image}}'
```

The server is the container running `yooooomi/your_spotify_server` (before the
switch) or `ghcr.io/thetastyhanuta/your_spotify_server` (after), the database is
the one running a `mongo` image. Then translate the commands like this:

| In this guide                         | Without Docker Compose                           |
| ------------------------------------- | ------------------------------------------------ |
| `docker compose exec server ...`      | `docker exec <server container> ...`             |
| `docker compose exec -d server ...`   | `docker exec -d <server container> ...`          |
| `docker compose cp server:/tmp/x ./x` | `docker cp <server container>:/tmp/x ./x`        |
| `docker compose stop server web`      | `docker stop <server container> <web container>` |

### Database Name

The commands assume the default database name `your_spotify`. If you set
`MONGO_ENDPOINT` on the server, the database name is its last part, for example
`mongodb://mongo:27017/my_stats` uses `my_stats`. Replace `your_spotify` in the
backup and rollback commands in that case.

### Spotify Credentials

The migration uses the `SPOTIFY_PUBLIC` and `SPOTIFY_SECRET` already configured
on your server. Nothing needs to change.

## Step 1: Back Up Your Database

Do this **before** switching images. The new server changes the database as soon
as it starts (regular migrations and storing ISRCs), so a backup taken afterwards
is no longer your original database.

```bash
docker compose exec mongo \
  mongodump --archive=/tmp/your_spotify-before-isrc.archive --db your_spotify
```

Copy the backup out of the container:

```bash
docker compose cp \
  mongo:/tmp/your_spotify-before-isrc.archive ./your_spotify-before-isrc.archive
```

Check that `your_spotify-before-isrc.archive` exists and is not empty. Keep it
until you are happy with the result.

## Step 2: Switch To This Fork

In your compose file, change the two app images:

| Service  | Original project               | This fork                                           |
| -------- | ------------------------------ | --------------------------------------------------- |
| `server` | `yooooomi/your_spotify_server` | `ghcr.io/thetastyhanuta/your_spotify_server:latest` |
| `web`    | `yooooomi/your_spotify_client` | `ghcr.io/thetastyhanuta/your_spotify_client:latest` |

Leave everything else as it is. In particular, **do not change the `mongo`
image**: MongoDB cannot open data files from a much older major version.

Pull only the two app images and restart:

```bash
docker compose pull server web
docker compose up -d
```

Watch the server log until it prints `Migrations successfully ran`, then press
Ctrl+C to stop following the log:

```bash
docker compose logs -f server
```

Check that the server now runs this fork's image. The output must show
`ghcr.io/thetastyhanuta/your_spotify_server`:

```bash
docker compose images server
```

Open the web app and make sure your stats still show up.

## Step 3: Run A Dry Run

The dry run fetches the ISRCs, finds the duplicates and writes a report, but does
not change the database.

Start it in the background, so it keeps running if you close the terminal or
lose your SSH connection:

```bash
docker compose exec -d server sh -c \
  'node /app/apps/server/build/index.js --merge-tracks-by-isrc \
  --report=/tmp/isrc-dry-run-report.md > /tmp/isrc-dry-run.log 2>&1'
```

Follow the progress. Ctrl+C only stops following, not the migration:

```bash
docker compose exec server tail -f /tmp/isrc-dry-run.log
```

It prints a line every 50 tracks, for example
`Step 2a: checked 1250/20000 tracks, found 1249 ISRCs, 0 failed`. The run is
finished when the log ends with `Disconnected from MongoDB`. If you see
`Failed to merge tracks by ISRC` right before that, the run stopped with an
error; the lines above it explain why.

Do not restart the server container while the migration runs, that stops it.
Stopping it is safe though, just start the same command again.

Copy the report out of the container:

```bash
docker compose cp server:/tmp/isrc-dry-run-report.md ./isrc-dry-run-report.md
```

Open `isrc-dry-run-report.md`. The **Final Summary** at the end shows how many
duplicates were found. Above it, each `### ISRC` block lists one recording: the
**primary** track that will be kept and the **secondaries** whose listens move
to it. The primary is the version you listened to most. This choice only decides
which track page represents the song; no listens are lost, and each listen keeps
the album you actually played it from.

## Step 4: Apply The Migration

Only continue if the dry-run report looks right.

The app can keep running. Do not start a history import in the settings while
the migration runs. If you did, or are unsure, simply run this step again
afterwards: a second run repairs anything the first one missed.

```bash
docker compose exec -d server sh -c \
  'node /app/apps/server/build/index.js --merge-tracks-by-isrc --apply \
  --report=/tmp/isrc-merge-report.md > /tmp/isrc-merge.log 2>&1'
```

Follow the progress the same way as before:

```bash
docker compose exec server tail -f /tmp/isrc-merge.log
```

When the log ends with `Disconnected from MongoDB`, copy the report:

```bash
docker compose cp server:/tmp/isrc-merge-report.md ./isrc-merge-report.md
```

Keep this report together with your backup. It lists every merged track and the
number of listens that were moved.

## Step 5: Check The Result

Open the web app and look up a few songs that used to appear more than once.
They should now show up once, with the listens combined.

Optionally run another dry run. It is much faster now, because the ISRCs are
already stored:

```bash
docker compose exec server \
  node /app/apps/server/build/index.js --merge-tracks-by-isrc \
  --report=/tmp/isrc-post-migration-audit.md
docker compose cp \
  server:/tmp/isrc-post-migration-audit.md ./isrc-post-migration-audit.md
```

It should report `Found 0 unique ISRCs with duplicates` and
`Listen records still attached to merged tracks: 0`.

You can delete the backup once you are happy with the result.

## Album And Track Counts

After the migration, track stats count the recording, while album stats still
count the release you listened to.

For example, if you listened to the same song twice on an album and once on an
EP, the song shows 3 listens. The album page still shows 2 listens for it, and
the EP page shows 1.

## If You Do Not Run The Migration

The app works fine without it:

- Your existing history stays as it is, including the duplicates.
- New tracks store their ISRC.
- A new listen of a song is added to the existing track with the same ISRC, if
  there is one. Older listens of other versions stay where they are until you
  run the migration.

You can run the migration at any later time.

## What The Migration Changes

For each recording with more than one track, the migration:

1. Chooses a primary track (the one with the most listens).
2. Moves the listens of the other tracks to the primary track.
3. Marks the other tracks as merged into the primary track (`mergedInto`).
4. Keeps the ISRC only on the primary track.

Merged tracks are not deleted, so the change can be traced in the database.

## Rollback

Restoring the backup from step 1 undoes the migration completely.

Stop the app, copy the backup into the Mongo container and restore it:

```bash
docker compose stop server web
docker compose cp \
  ./your_spotify-before-isrc.archive mongo:/tmp/your_spotify-before-isrc.archive
docker compose exec mongo \
  mongorestore --drop --archive=/tmp/your_spotify-before-isrc.archive --nsInclude='your_spotify.*'
```

Listens recorded after the backup was taken are lost, unless Spotify still
returns them (it keeps roughly the last 50 plays).

To go back to the original project as well, change the two images back to
`yooooomi/your_spotify_server` and `yooooomi/your_spotify_client` and pull them:

```bash
docker compose pull server web
```

Then start the app:

```bash
docker compose up -d
```

## For Developers

### Repository Compose Files

When running this repository with `docker-compose-prod.yml` and
`docker-compose-personal.yml`, the server service is named `app` and every
command needs the compose files:

```bash
docker compose -f docker-compose-prod.yml -f docker-compose-personal.yml exec app \
  node /app/apps/server/build/index.js --merge-tracks-by-isrc \
  --report=/tmp/isrc-dry-run-report.md
```

### Without Docker

Build the server first. The command reads the same environment variables as the
server (`MONGO_ENDPOINT`, `SPOTIFY_PUBLIC`, `SPOTIFY_SECRET`, `API_ENDPOINT`,
`CLIENT_ENDPOINT`). `MONGO_ENDPOINT` defaults to
`mongodb://mongo:27017/your_spotify`, which only resolves inside Docker.

With the `apps/server/.env` file from the [local installation guide](../../LOCAL_INSTALL.md#hosting-backend), run these commands from the repository root:

```bash
cd apps/server
pnpm build
node --env-file=.env build/index.js --merge-tracks-by-isrc --report=/tmp/isrc-dry-run-report.md
```

Review the dry-run report and follow the backup steps above before applying:

```bash
node --env-file=.env build/index.js --merge-tracks-by-isrc --apply --report=/tmp/isrc-merge-report.md
```
