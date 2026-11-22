# Contributing

Thanks for helping out. Bugs and ideas go in [issues](https://github.com/TheTastyHanuta/your_spotify/issues/new/choose); if a bug also happens with the [original project](https://github.com/Yooooomi/your_spotify), please report it there as well.

[AGENTS.md](AGENTS.md) explains how the code is organised and the rules it follows (tests, queries, Spotify requests). It is written for coding agents, but it is the best overview for humans too.

## Setup

You need Node 24 and Docker. pnpm comes through Corepack, pinned by `packageManager` in `package.json`:

```bash
corepack enable
pnpm install
```

To run the full stack, create a [Spotify application](README.md#2-create-the-spotify-application) with the redirect URI `http://127.0.0.1:8080/oauth/spotify/callback`, then create `docker-compose-personal.yml` in the repository root (it is git-ignored):

```yaml
services:
  app:
    environment:
      SPOTIFY_PUBLIC: your_client_id
      SPOTIFY_SECRET: your_client_secret
  mongo:
    image: mongo:4.4 # the oldest supported version, so queries stay compatible
```

`./dev.sh` then starts MongoDB, the server on port 8080 and the client on <http://127.0.0.1:3000>. Log in with Spotify there; the first account becomes the administrator (see [First start](README.md#4-first-start)). New listens appear after a few minutes of playing music; to get more data to work with, [import your past history](README.md#importing-past-history).

To run without Docker, follow [LOCAL_INSTALL.md](LOCAL_INSTALL.md).

## Checks

Before opening a pull request, run these in each app you changed (`apps/server`, `apps/client`):

```bash
pnpm lint       # pnpm lint:fix fixes most issues
pnpm typecheck
pnpm test
```

CI runs the same checks plus a build, and they must pass before merging. New logic should come with tests; see the Tests section in AGENTS.md.

## Branches and pull requests

- Branch from an up-to-date `master` and name the branch after the kind of change: `feature/…`, `fix/…`, `refactor/…`, `docs/…` or `chore/…` (releases, dependency updates and other upkeep).
- One logical change per pull request. Unrelated fixes go in their own pull request.
- Pull request titles are short lowercase one-liners that say what changes, for example `fix percent changes one point too low`. Pull requests are squash-merged, so the title becomes the commit message on `master`.
- The description starts with one sentence on why, then one bullet per change a reader would notice. Always say what people running the app must do or will notice: config, env variables, compose, migrations, removed or renamed things, API changes, stored data. The pull request template has these headings.
- Leave version numbers alone; the maintainer bumps them when making a release.

By contributing, you agree that your contributions are licensed under the [GPL-3.0](LICENSE), like the rest of the project.
