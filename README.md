![Nightly build](https://github.com/TheTastyHanuta/your_spotify/actions/workflows/nightly.yml/badge.svg)
![Release](https://github.com/TheTastyHanuta/your_spotify/actions/workflows/release.yml/badge.svg)

<p align='center'>
  <img width="100%" src="https://user-images.githubusercontent.com/17204739/154752226-c2215a51-e20e-4ade-ac63-42c5abb25240.png">
</p>

# Your Spotify

**YourSpotify** is a self-hosted application that tracks what you listen and offers you a dashboard to explore statistics about it!
It's composed of a web server which polls the Spotify API every now and then and a web application on which you can explore your statistics.

> **This is a fork** of [Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify), maintained since April 2026, with some additional features on top of upstream. I try to stay in sync with upstream regularly. This fork adds:
>
> - **Track deduplication by ISRC** - merges duplicate tracks (e.g. different releases/remasters of the same song) into a single entry with combined listen history
> - **Multi-artist support** - track and album pages now show every credited artist (labeled main/featured), not just one; artist pages and search now work for artists you've only ever heard as a featured credit (previously showed "never listened"); and the artist page separates primary listens from featured-artist listens
> - **Listened album context** - track and history views show which specific album version a track was actually played from
> - **Better Spotify auth handling** - detects when Spotify has revoked your tokens and shows a re-authentication prompt instead of failing silently
> - **Spotify rate limit handling** - a configurable pause between Spotify requests ([`SPOTIFY_API_DELAY_MS`](#environment-variables)) makes bans less likely; when Spotify does ban the app for hours, imports and logins fail with a clear log message and the server still starts, instead of everything hanging silently
> - **Importer reliability** - imports no longer silently drop listens, resume from the right place after a failure, and clean up their uploaded files
> - Various fixes: infinite scroll, affinity stats on empty ranges and large histories, album page crash, searching with special characters, date presets in tabs left open for a long time
>
> This is a personal fork and not officially affiliated with or supported by the upstream project. For the original application, see the link above.
>
> **No warranty.** This fork is provided as-is, with no guarantee it will work correctly and no support commitment. Back up your database before upgrading or running any [migration](#fork-specific-migrations) below, and use it at your own risk.

## Table of contents

- [Prerequisites](#prerequisites)
- [Creating the Spotify application](#creating-the-spotify-application)
- [Installation](#installation)
  - [Using Docker Compose](#using-docker-compose)
  - [Environment variables](#environment-variables)
  - [Advanced CORS settings](#advanced-cors-settings)
  - [Building the images yourself](#building-the-images-yourself)
  - [Installing locally (not recommended)](#installing-locally-not-recommended)
- [Updating](#updating)
- [Importing past history](#importing-past-history)
  - [Supported import methods](#supported-import-methods)
    - [Privacy data](#privacy-data)
    - [Full privacy data (recommended)](#full-privacy-data-recommended)
  - [Troubleshooting](#troubleshooting)
- [Fork-specific migrations](#fork-specific-migrations)
  - [ISRC track deduplication](#isrc-track-deduplication)
- [FAQ](#faq)
- [External guides](#external-guides)
- [Contributing](#contributing)
- [Supporting the original project](#supporting-the-original-project)
- [License](#license)

## Prerequisites

1. A machine with [Docker](https://docs.docker.com/get-started/get-docker/) and Docker Compose (the `docker compose` command).
2. A Spotify application, see [Creating the Spotify application](#creating-the-spotify-application). The server needs its **public** AND **secret** key.
3. An **authorized** redirect URI in the Spotify application that points to your server.

## Creating the Spotify application

For **YourSpotify** to work you need to provide a Spotify application **public** AND **secret** to the server environment.
To do so, you need to create a **Spotify application** [here](https://developer.spotify.com/dashboard/applications).

1. Click on **Create app**.
2. Fill out all the information.
3. Set the redirect URI, corresponding to your **server** location on the internet (or your local network) adding the suffix **/oauth/spotify/callback**.
   - i.e: `http://127.0.0.1:8080/oauth/spotify/callback` or `https://home.mydomain.com/your_spotify_backend/oauth/spotify/callback`
4. Check **Web API**
5. Check **I understand and agree**
6. Hit **Settings** at the top right corner
7. Copy the **public** and the **secret** key into your compose file under the name of `SPOTIFY_PUBLIC` and `SPOTIFY_SECRET` respectively.
8. Once you have created your application, Spotify wants you to register the users that will be able to access the application. (You don't need to do that for the account that created the application)
   1. Click the **User Management** button
   2. Enter the required information, a name and the email the user's Spotify account has been created with.
   3. (Optional) You can **Request extension** if you do not want to register the users by hand.

## Installation

### Using Docker Compose

The images are published on the GitHub Container Registry:

- `ghcr.io/thetastyhanuta/your_spotify_server`
- `ghcr.io/thetastyhanuta/your_spotify_client`

The `latest` tag is the newest release, `nightly` follows the `master` branch.

Create a `compose.yaml` file like the one below (also available as [docker-compose-example.yml](docker-compose-example.yml)) and start it with `docker compose up -d`.

Choose the setup that matches how you will access YourSpotify:

#### On the device running Docker

Keep the provided `127.0.0.1` values, open `http://127.0.0.1:3000`, and register this Spotify redirect URI:

```text
http://127.0.0.1:8080/oauth/spotify/callback
```

#### From another device on the local network using SSH

Keep the Compose configuration unchanged and make sure SSH is enabled on the Docker host. On the other device, run the following command and keep it open:

```bash
ssh -N -L 3000:127.0.0.1:3000 -L 8080:127.0.0.1:8080 pi@192.168.1.50
```

Replace `pi` and `192.168.1.50` with the host's SSH username and local IP address, then open `http://127.0.0.1:3000`. Use the same Spotify redirect URI as above.

#### Through an HTTPS reverse proxy

Configure Nginx, Caddy, Traefik, or another proxy to forward your frontend address to port `3000` and your API address to port `8080`. Replace the three endpoints in the Compose file, for example:

```yml
server:
  environment:
    API_ENDPOINT: https://api.yourspotify.example.com
    CLIENT_ENDPOINT: https://yourspotify.example.com

web:
  environment:
    API_ENDPOINT: https://api.yourspotify.example.com
```

Register `https://api.yourspotify.example.com/oauth/spotify/callback` as the Spotify redirect URI. Spotify [requires HTTPS](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) unless the redirect uses a loopback address such as `127.0.0.1`.

```yml
services:
  server:
    image: ghcr.io/thetastyhanuta/your_spotify_server:latest
    restart: always
    ports:
      - "8080:8080"
    depends_on:
      - mongo
    environment:
      API_ENDPOINT: http://127.0.0.1:8080 # This MUST be included as a valid URL in the Spotify dashboard (see above)
      CLIENT_ENDPOINT: http://127.0.0.1:3000
      SPOTIFY_PUBLIC: __your_spotify_client_id__
      SPOTIFY_SECRET: __your_spotify_secret__

  mongo:
    image: mongo:8
    restart: always
    volumes:
      - ./your_spotify_db:/data/db

  web:
    image: ghcr.io/thetastyhanuta/your_spotify_client:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      API_ENDPOINT: http://127.0.0.1:8080
```

### Environment variables

| Key                   | Default value (if any)             | Description                                                                                                                                                       |
| :-------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLIENT_ENDPOINT       | REQUIRED                           | The endpoint of your web application                                                                                                                              |
| API_ENDPOINT          | REQUIRED                           | The endpoint of your server                                                                                                                                       |
| SPOTIFY_PUBLIC        | REQUIRED                           | The public key of your Spotify application (cf [Creating the Spotify Application](#creating-the-spotify-application))                                             |
| SPOTIFY_SECRET        | REQUIRED                           | The secret key of your Spotify application (cf [Creating the Spotify Application](#creating-the-spotify-application))                                             |
| TIMEZONE              | Europe/Paris                       | The timezone of your stats, only affects read requests since data is saved with UTC time                                                                          |
| MONGO_ENDPOINT        | mongodb://mongo:27017/your_spotify | The endpoint of the Mongo database, where **mongo** is the name of your service in the compose file                                                               |
| PROMETHEUS_USERNAME   | _not defined_                      | Prometheus basic auth username (see [here](apps/server/README.md#prometheus))                                                                                     |
| PROMETHEUS_PASSWORD   | _not defined_                      | Prometheus basic auth password                                                                                                                                    |
| LOG_LEVEL             | info                               | The log level, debug is useful if you encounter any bugs                                                                                                          |
| CORS                  | _not defined_                      | List of comma-separated origin allowed (not required; defaults to CLIENT_ENDPOINT)                                                                                |
| COOKIE_VALIDITY_MS    | 1h                                 | Validity time of the authentication cookie, following [this pattern](https://github.com/vercel/ms)                                                                |
| MAX_IMPORT_CACHE_SIZE | 100000                             | The maximum number of cached items per user during an import. A larger cache reduces Spotify requests and can make imports faster                                 |
| MONGO_NO_ADMIN_RIGHTS | false                              | Do not ask for admin right on the Mongo database                                                                                                                  |
| PORT                  | 8080                               | The port of the server, **do not** modify if you're using docker                                                                                                  |
| FRAME_ANCESTORS       | _not defined_                      | Sites allowed to frame the website, comma separated list of URLs (`i-want-a-security-vulnerability-and-want-to-allow-all-frame-ancestors` to allow every website) |
| SPOTIFY_API_DELAY_MS  | 2000                               | Minimum delay in milliseconds between each Spotify request (imports, polling, login). Helps avoid being rate limited by Spotify when importing data               |

### Advanced CORS settings

**Manually specifying CORS configuration is not required for typical deployments.**
99.9% of users do not need to worry about this, it is handled automatically.

If your use case requires the backend to be used from multiple frontend origins, you can manually adjust the `CORS` variable.
For example, a value of `origin1,origin2` will allow `origin1` and `origin2`.

### Building the images yourself

If you prefer not to use the published images, you can build them from this repository:

```bash
git clone https://github.com/TheTastyHanuta/your_spotify.git
cd your_spotify
docker build -f Dockerfile.server.production -t your_spotify_server .
docker build -f Dockerfile.client.production -t your_spotify_client .
```

Then use `your_spotify_server` and `your_spotify_client` as the `image` of the `server` and `web` services in your compose file.

### Installing locally (not recommended)

You can follow the instructions [here](LOCAL_INSTALL.md). Note that you still need the [Spotify application](#creating-the-spotify-application).

## Updating

Run these commands in the directory containing your compose file:

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically when the server starts. Back up your database before updating.

## Importing past history

By default, **YourSpotify** will only retrieve data for the past 24 hours once registered. This is a technical limitation. However, you can import previous data by two ways.

The import process uses a cache to limit requests to the Spotify API. It stores up to 100,000 items per user by default; you can change the limit with the `MAX_IMPORT_CACHE_SIZE` environment variable on the **server**.

### Supported import methods

#### Privacy data

> Takes a maximum of 5 days.
> Only gets you the last year of history.

- Request your **privacy data** at Spotify to have access to your history for the past year [here](https://www.spotify.com/us/account/privacy/).
- Head to the **Settings** page and choose the **Account data** method.
- Input your files starting with `StreamingHistoryX.json`.
- Start your import.

#### Full privacy data (recommended)

> Takes a maximum of 30 days.
> Gets you the whole history since the creation of your account.

- Request your **Full privacy data** to have access to your history data since the creation of the account [here](https://www.spotify.com/us/account/privacy/).
- Head to the **Settings** page and choose the **Extended streaming history** method.
- Input your files starting with `Streaming_History_Audio_YYYY-YYYY_X.json`.
- Start your import.

### Troubleshooting

An import can fail:

- If the server reboots.
- If a request fails 10 times in a row.
- If Spotify rate limits the application for a long time. The server log shows until when, retry the import after that.

A failed import can be retried in the **Settings** page. Be sure to clean your failed imports if you do not want to retry it as it will remove the files used for it.

It is safer to import data at account creation. Though **YourSpotify** detects duplicates, some may still be inserted.

## Fork-specific migrations

### ISRC track deduplication

If you already had an instance running before switching to this fork, your database may contain duplicate tracks that are really the same song (e.g. from a single vs. an album re-release), which this fork's [track deduplication](#your-spotify) feature does not clean up retroactively. A one-off, opt-in migration script is included to merge those; it defaults to a dry run and includes backup/rollback steps.

See [`apps/server/ISRC_DEDUPLICATION.md`](apps/server/ISRC_DEDUPLICATION.md) for the full guide.

## FAQ

### How can I block new registrations?

From an admin account, go to the **Settings** page and hit the **Disable new registrations** button.

### Songs don't seem to synchronize anymore

This can happen if you revoked access on your Spotify account. To re-sync the songs, go to settings and hit the **Relog to Spotify** button.

### The web application is telling me it cannot retrieve global preferences

This means that your web application can't connect to the backend. Check that your **API_ENDPOINT** env variable is reachable from the device you're using the platform from.

### A user is not in the same timezone as the server, how can they use their own timezone?

Any user can set their own timezone in the settings, it will be used for any computed statistics. The timezone of the device will be used for everything else, such as song history.

## External guides

- [BreadNet](https://breadnet.co.uk/your-spotify-2022) installation tutorial (written for the original project)

## Contributing

If you found a bug in this fork or have an idea, feel free to open an [issue](https://github.com/TheTastyHanuta/your_spotify/issues/new/choose). If the problem also happens with the original project, please report it [there](https://github.com/Yooooomi/your_spotify/issues) as well.

## Supporting the original project

**YourSpotify** is created by [Yooooomi](https://github.com/Yooooomi), who works on it in their spare time. If you find it useful, consider supporting the original project:

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate/?hosted_button_id=BLAPT49PK9A8G)

## License

**YourSpotify** is licensed under the [GNU General Public License v3.0](LICENSE). This fork is a modified version of [Yooooomi/your_spotify](https://github.com/Yooooomi/your_spotify), changed since April 2026, and is distributed under the same license. The commit history lists every change.
