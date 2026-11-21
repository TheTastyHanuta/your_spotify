# AGENTS.md

Guidance for coding agents (and humans) working in this repository. The workflow for branches, commits and pull requests is in [CONTRIBUTING.md](CONTRIBUTING.md). Branch names start with `feature/`, `fix/`, `refactor/` or `docs/`. Pull request descriptions use the headings of `.github/pull_request_template.md`; `gh pr create --body` or `--body-file` replaces the template, so write them out.

YourSpotify is a self-hosted Spotify stats dashboard: an Express server polls each user's recently played tracks into MongoDB, and a React client shows the stats. This is a fork of Yooooomi/your_spotify (default branch `master`).

Keep this file about current behaviour, not history.

## Commands

pnpm workspace: `apps/server`, `apps/client`, and `apps/dev` (only the shared oxlint/oxfmt config). Shared dev-dependency versions live under `catalog:` in `pnpm-workspace.yaml`; the pnpm version is pinned by `packageManager` in the root `package.json`. CI uses Node 24.

Run in `apps/server` or `apps/client`:

- `pnpm lint` / `pnpm lint:fix`: oxlint + oxfmt
- `pnpm typecheck`
- `pnpm test`: Vitest, once (`pnpm vitest` to watch; `pnpm test` in the root runs both apps). `pnpm coverage` writes `coverage/` (not committed).
- `pnpm build`: rsbuild production build
- `pnpm dev` (server) / `pnpm start` (client): dev server
- `pnpm migrate` (server, after a build): runs pending migrations

`.github/workflows/checks.yml` runs lint, typecheck, test and build for both apps; its `checks` job is required for merging.

Full stack: `./dev.sh` starts the dev compose (mongo 27017, server 8080, client 3000) with your local `docker-compose-personal.yml` on top (see CONTRIBUTING.md); `./prod.sh` does the same with the production compose.

Production images: the server is plain Alpine with only the `node` binary (no npm/pnpm at runtime), running as `node`; the client is nginx (`apps/client/scripts/run/nginx.conf`, edited at start by `variables.sh`), running as `nginx`.

## Tests

- `*.test.ts` files sit next to the code. They test logic only: no database, no real network, no React rendering.
- Keep "functional core, imperative shell": decisions and maths go in pure functions that take and return plain data; queries, routes, loops and React code only call them. A pure function can stay in the file that uses it (the server's Vitest config sets dummy env values, so any server module can be imported); it gets its own module when other files share it.
- Use `toStrictEqual` for structures (`toEqual` lets `{ a: undefined }` pass for `{}`) and matchers that print values (`toHaveLength`, `toBeLessThanOrEqual`) instead of `expect(cond).toBe(true)`.
- Both Vitest configs undo `vi.stubGlobal` and `vi.spyOn` before each test, so an `afterAll` still sees the last test's stubs. Reset module-level state (such as `apiCache`'s `cache`) in a `beforeEach`.
- For timing and HTTP, copy `tools/apis/queueHttpClient.test.ts`: stubbed `fetch` returning real `Response`s, and fake only `setTimeout`/`Date` (faking `setImmediate` stalls `Response` bodies).

## Server (`apps/server`, Express 5 + Mongoose)

- `bin/www.ts` starts the HTTP server and the background loops: the poller (`spotify/looper.ts`, off with `DISABLE_POLLING=true`), the ISRC merge (`tools/isrcMerge/loop.ts`) and MusicBrainz genres (`tools/genres.ts`). It also restores a stored Spotify ban and resumes imports.
- **Data model** (`database/schemas/`): `Infos` holds one document per listen with Spotify string IDs (`id`, `albumId`, `primaryArtistId`, `artistIds`). Tracks, albums and artists are keyed by Spotify ID and joined through Mongoose virtuals, not ObjectId refs. Duplicate recordings are merged by ISRC: a duplicate keeps `mergedInto` pointing to the canonical track, and ingestion resolves to it (`tools/canonicalTracks.ts`). ISRCs are compared as plain strings, so every ISRC read from Spotify goes through `isrcOf` (`tools/isrc.ts`), which stores it uppercase without hyphens.
- **Every new stats query over `Infos` must filter `blacklistedBy`**: overall stats use `blacklistedBy: { $exists: 0 }`; artist/album/track detail pages count artist-blacklisted listens but add `notRemoved` (`schemas/info.ts`). Removed listens stay stored so the poller and importers don't record them again, which is why duplicate detection (`getCloseTrackId` in `database/queries/user.ts`) must stay unfiltered.
- **Stats** are aggregation pipelines in `database/queries/` (shared stages in `statsTools.ts`). They must run on MongoDB 4.4, so no newer aggregation features. Routes stay thin: zod-validated params (`tools/zod.ts`), then a query call.
- **Auth**: Spotify OAuth (`routes/oauth.ts`, `tools/oauth/`), JWT in a cookie that `storeSessionCookie` sets and the `logged` middleware renews (`tools/middleware.ts`). User queries leave out `accessToken`/`refreshToken` unless asked for them (`database/queries/user.ts`), so the client never sees tokens and token state needs its own field: users whose Spotify tokens stopped working get `spotifyReauthRequired`; the poller skips them and the client asks them to log in again.
- **Outgoing HTTP** (Spotify, GitHub) always goes through `QueuedHttpClient` (`tools/apis/queueHttpClient.ts`, instances in `queuedHttpClient.providers.ts`), which spaces Spotify requests and retries short 429s. A 429 that persists throws `RateLimitedError`: callers pause, they don't retry. A long ban makes every request fail fast until it ends.
- **Spotify request budget**: every request is counted per source (`requestSource` AsyncLocalStorage, `database/queries/spotifyUsage.ts`), so run new Spotify calls under a source. Imports and ISRC lookups stop at the admin's daily budget (`BudgetExceededError` from `checkToken` in `spotifyApi.ts`). Imports pause on `RateLimitedError` and resume themselves (`tools/importers/importer.ts`).
- **Migrations**: timestamp-prefixed files in `src/migrations/`, run with `--migrate` at container start. Each new migration must be imported and added to the map in `src/migrations.ts` (which also holds the Mongo-backed store), or it never runs.

## Client (`apps/client`, React 19 + rsbuild + MUI + Redux Toolkit)

- Pages in `src/scenes/` (routed in `App.tsx`), shared UI in `src/components/`, Redux in `services/redux/modules/`.
- All server calls go through `services/apis/api.ts`. The API URL comes from `window.API_ENDPOINT`, injected at runtime by `variables.js`, not from a build-time env variable.
- `useAPI` refetches whenever an argument changes identity: build derived `Date`s with `useMemo`, or the request repeats forever. Its cache (`services/apiCache.ts`) is keyed by `userKey` in `hooks.ts`; a new server-side setting that changes answers must be added there.
- Pages are built from `PageHero`, `StatStrip`, `Section` and `ItemRow`. Design tokens live in `index.css` (`.dark-vars`/`.light-vars`) and `services/theme.ts` mirrors them; the page tint (`--tint*`) comes from the lead cover (`services/hooks/useCoverColor.ts`); multi-series charts use `--series-*`. Fonts are bundled files because the CSP blocks `data:` fonts.

## Configuration

Instance config is env variables, listed in the README's "Environment variables" table. Server variables are validated in `apps/server/src/tools/env.ts`; the web container reads `API_ENDPOINT` and `FRAME_ANCESTORS` in `apps/client/scripts/run/variables.sh`. A new variable goes in one of those and in the README table. Per-user settings and admin preferences are stored in MongoDB, not in env variables. Data is stored in UTC; `TIMEZONE` only affects read-side aggregation.

## Docs

The README and other docs describe how things work now. Notes about a change between versions ("X was removed", "after updating, do Y") go in the release notes, not the docs; what people running the app must do or will notice goes under the pull request's "For people running the app" heading, and the release notes are written from it at release time. The README's "This fork adds" list and the guides for switching from the original project stay, because they remain true.
