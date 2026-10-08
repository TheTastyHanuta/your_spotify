# Your Spotify server

## Table of Contents

- [Prometheus](#prometheus)
- [Operations](#operations)
- [API](#api)
  - [Authentication](#authentication)
    - [OAuth](#oauth)
  - [User Management](#user-management)
    - [Account](#account)
    - [Admin](#admin)
  - [Spotify Integration](#spotify-integration)
    - [Playback](#playback)
    - [Playlist Management](#playlist-management)
  - [History & Statistics](#history--statistics)
    - [Top Items](#top-items)
    - [Discoveries](#discoveries)
    - [Your Story](#your-story)
    - [Collaborative Features](#collaborative-features)
  - [Search](#search)
  - [Artist](#artist)
  - [Album](#album)
  - [Track](#track)
  - [Import](#import)
  - [Global Preferences](#global-preferences)
  - [Account Settings](#account-settings)

## Prometheus

You can access various prometheus metrics through `/metrics`:

- **http_requests_total**: Total number of HTTP requests
- **http_request_duration_nanoseconds**: Duration of HTTP requests in nanoseconds
- **imports_total**: Total number of imports
- **ingested_tracks_total**: Total number of ingested tracks from Spotify API
- **ingested_albums_total**: Total number of ingested albums from Spotify API
- **ingested_artists_total**: Total number of ingested artists from Spotify API

You will need to define to environment variable in the server:

- **PROMETHEUS_USERNAME**: the basic auth username expected by the server to authorize the request
- **PROMETHEUS_PASSWORD**: the expected password

Those values are to be referenced in the configuration of your Prometheus instance:

```yml
scrape_configs:
  - job_name: "your_spotify"
    basic_auth:
      username: "myuser" # PROMETHEUS_USERNAME
      password: "mypassword" # PROMETHEUS_PASSWORD
    static_configs:
      - targets: ["example.com:443"]
```

## Operations

- [ISRC Track Deduplication](./ISRC_DEDUPLICATION.md): run the manual migration
  for merging duplicate Spotify track IDs that represent the same recording.

## API

## Authentication

### OAuth

#### `GET /oauth/spotify`

Initiates Spotify OAuth flow.

**Response:**

- Redirects to Spotify login page
- For development: Returns 204 if offline mode enabled

#### `GET /oauth/spotify/callback`

Handles Spotify OAuth callback.

**Query Parameters:**

- `code`: string - OAuth code from Spotify
- `state`: string - State parameter for security

**Response:**

- Redirects to client application

#### `GET /oauth/spotify/me`

Gets current user's Spotify profile.

**Response:**

- `200`: Spotify user profile
- `500`: Error with code "SPOTIFY_ERROR"

## User Management

### Account

#### `GET /me`

Get current user information.

**Response:**

```json
{
  "status": boolean,
  "user": UserObject // Only if status is true
}
```

#### `GET /accounts`

Get list of all users (requires authentication).

**Response:**

```json
[{
  "id": string,
  "username": string,
  "admin": boolean,
  "firstListenedAt": Date
}]
```

#### `PUT /rename`

Change username.

**Body:**

```json
{
  "newName": string // 2-64 characters
}
```

**Response:**

- `204`: Success
- `500`: Error

### Admin

#### `PUT /admin/:id`

Set user admin status (requires admin).

**Parameters:**

- `id`: User ID

**Body:**

```json
{
  "status": boolean
}
```

**Response:**

- `204`: Success
- `400`: Error if trying to remove last admin
- `500`: Error

#### `DELETE /account/:id`

Delete user account (requires admin).

**Parameters:**

- `id`: User ID

**Response:**

- `204`: Success
- `404`: User not found
- `500`: Error

## Spotify Integration

### Playback

#### `POST /spotify/play`

Start playback of a track.

**Body:**

```json
{
  "id": string // Spotify track ID
}
```

**Response:**

- `200`: Success
- `400`: Invalid track or playback error
- `500`: Server error

### Playlist Management

#### `GET /spotify/playlists`

Get user's Spotify playlists.

**Response:**

- `200`: Array of user's Spotify playlists

#### `POST /spotify/playlist/create`

Create a new Spotify playlist or add tracks to existing playlist.

**Body:**

```json
{
  "playlistId": string?, // Existing playlist ID (optional)
  "name": string?, // New playlist name (optional)
  "sortKey": string?, // Sort key for tracks (default "count")
  "type": "top" | "affinity" | "single", // Playlist type

  // For type "top"
  "interval": {
    "start": date,
    "end": date
  },
  "nb": number, // Number of tracks to include

  // For type "affinity"
  "interval": {
    "start": date,
    "end": date
  },
  "nb": number, // Number of tracks to include
  "userIds": string[], // User IDs for collaboration
  "mode": "intersection" | "union", // Collaboration mode

  // For type "single"
  "songId": string // Single track ID to add
}
```

**Response:**

- `204`: Successfully created or updated playlist
- `400`: Invalid request
- `500`: Server error

## History & Statistics

#### `GET /spotify/gethistory`

Get user's listening history.

**Query Parameters:**

- `number`: number - Maximum number of items to return (max 20)
- `offset`: number - Number of items to skip
- `start`: date (optional) - Start date
- `end`: date (optional) - End date

**Response:**

- `200`: Array of listening history items

#### `GET /spotify/listened_to`

Get count of songs listened to in a time period.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: `{ count: number }`

#### `GET /spotify/most_listened`

Get most listened songs in a time period.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Array of most listened songs with counts

#### `GET /spotify/songs_per`

Get the number of plays, different songs and different artists per time unit.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Array of time periods with `count` (plays), `differents` (different songs) and `differentArtists`

#### `GET /spotify/time_per`

Get listening time per time unit.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Array of time periods with listening durations

#### `GET /spotify/overview`

Get the numbers behind the Habits page for a period: plays, listening time, different songs, artists and albums, songs and artists heard for the first time ever, active days, the busiest day, the longest and current streaks, plays per weekday and hour (in the stats timezone), and `clump`, the plays per listened hour weighted by plays (1 when plays come one by one), used to tell real changes from chance.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Object with `plays`, `durationMs`, `tracks`, `artists`, `albums`, `newArtists`, `newTracks`, `activeDays`, `busiestDay`, `streaks`, `clump` and `heatmap` (weekday 1–7 from Monday, hour, plays, durationMs)

#### `GET /spotify/calendar`

Get the plays and listening time of each day with listens, in the stats timezone.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Array of days with `date` (`YYYY-MM-DD`), `plays` and `durationMs`

#### `GET /spotify/taste`

Get the plays per album release year (each with its most played song), how old the songs were when played (at most a year old, or at least 10 years old), plays per release type, explicit plays and plays per song length.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Object with `years`, `ageWhenPlayed`, `albumTypes`, `explicit` and `lengths` (under 2 min, 2–3, 3–4, 4–5, 5 min and more)

#### `GET /spotify/taste/decades`

Get the plays per release decade for each year of the whole history.

**Response:**

- `200`: Array of years with `decades` (decade and plays, oldest first)

#### `GET /spotify/genres`

Get the most played genres, using MusicBrainz genres first and Spotify's otherwise. An artist's plays count for each of its genres, so genres overlap.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of genres to return (1-50, default 20)

**Response:**

- `200`: Object with `totalPlays`, `coveredPlays` (plays with a known genre) and `genres` (each with plays, listening time and up to 3 artists)

#### `GET /spotify/timeline`

Get an artist's, album's or song's plays per month from its first listen up to now, and per weekday and hour, next to all your listening between its first and last listen.

**Query Parameters:**

- `type`: string - `artist`, `album` or `track`
- `id`: string - Spotify ID

**Response:**

- `200`: Object with `months`, `weekdays`, `hours` and `overall`, or `{ code: "NEVER_LISTENED" }`

#### `GET /spotify/taste/artist_shares`

Get the period's top 10 artists by plays, and the plays of its top 8 artists in each time unit, with each time unit's total plays.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Object with `plays`, `top` (artists with their plays) and `steps` (time periods with `plays` and the top artists' plays by artist ID)

#### `GET /spotify/taste/release_years_per`

Get the plays per album release year for each time unit.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Array of time periods with `years` (release year and plays, oldest first)

#### `GET /spotify/time_per_hour_of_day`

Get listening distribution by hour of day.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Distribution of listening time by hour

#### `GET /spotify/best_artists_per`

Get top artists per time unit.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)

**Response:**

- `200`: Top artists for each time unit

### Top Items

#### `GET /spotify/top/songs`

Get top songs in a time period.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of items to return (1-30)
- `offset`: number - Number of items to skip (default 0)
- `sortKey`: string - Sort criteria (default "count")

**Response:**

- `200`: Array of top song objects

#### `GET /spotify/top/artists`

Get top artists in a time period.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of items to return (1-30)
- `offset`: number - Number of items to skip (default 0)
- `sortKey`: string - Sort criteria (default "count")

**Response:**

- `200`: Array of top artist objects

#### `GET /spotify/top/albums`

Get top albums in a time period.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of items to return (1-30)
- `offset`: number - Number of items to skip (default 0)
- `sortKey`: string - Sort criteria (default "count")

**Response:**

- `200`: Array of top album objects

#### `GET /spotify/top/part-of-day`

Get the top 5 artists or songs of each part of the day: morning (5–11), afternoon (11–17), evening (17–22) and night (22–5), in the stats timezone. Counts plays or listening time, following the user's statistics setting.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `type`: string - `artists` or `tracks`

**Response:**

- `200`: Array of parts of the day, each with its total and its top items with their totals

#### `GET /spotify/top/sessions`

Get the five longest listening sessions in the selected period, shown under **Habits → Longest sessions** in the client. A session ends when the next song starts more than 10 minutes after the previous song ends. Duration runs from the first song's start through the last song's end, including pauses within the session; it is also used to rank sessions.

Sessions are split in server code, so this endpoint works with MongoDB 4.4. It loads the selected period's plays into memory before selecting the longest five.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Array of sessions, longest first. Each has `plays` (listening events in chronological order), `sessionLength` (milliseconds), `full_tracks` (track objects keyed by Spotify ID) and `full_albums` (album objects keyed by Spotify ID)

### Discoveries

A song or artist is new when its first listen ever is in the period. All of these count plays.

#### `GET /spotify/discoveries`

Get the artists heard for the first time in the period, most played first, with the first song heard.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of artists to return (1-20, default 5)

**Response:**

- `200`: Array of artists with their plays in the period, first listen and first song

#### `GET /spotify/discoveries/songs`

Get the songs heard for the first time in the period that were played again at least 30 days after the first listen (that play may be after the period), most played in the period first.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `nb`: number - Number of songs to return (1-20, default 5)

**Response:**

- `200`: Array of songs with `plays` in the period, `first` (first listen) and `months` (number of months of the period with plays, in the stats timezone)

#### `GET /spotify/discoveries/overview`

Get the numbers of new artists and songs, the new songs by artists played before the period, the artists back after a break (at least 10 plays, then none for 6 months) and whether the artists discovered in the period stuck (at least 3 plays from 3 months after the first listen).

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Object with the counts, `knownArtistTracks`, `comebacks` and `stick`

#### `GET /spotify/discoveries/on-repeat`

Get the 20 songs with the most plays inside any 7 days of the period (at least 5), with the first and last day of those 7 days that had plays.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)

**Response:**

- `200`: Array of songs with `plays`, `from` and `to` (`YYYY-MM-DD` in the stats timezone)

#### `GET /spotify/discoveries/per`

Get the plays of each time step, and the plays of songs heard for the first time in the period and in that same step.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (hour, day, week, month, year)

**Response:**

- `200`: Array of steps with `count` and `newCount`

### Your Story

#### `GET /spotify/story/forgotten`

Get the 20 most played songs and 20 most played artists of all time (at least 10 plays) that were not played for the given number of days, with their total plays, last play, and the month with the most plays (`YYYY-MM` in the stats timezone).

**Query Parameters:**

- `days`: number - `91`, `182` or `365`

**Response:**

- `200`: Object with `tracks` and `artists`

#### `GET /spotify/story/eras`

Get the stretches of at least 3 months when one artist or genre (an artist's first genre) clearly led the listening: over the month and the months next to it, at least 1.2 times the plays of number two and at least 3% (artists) or 5% (genres) of all plays, played in the month itself, in months with at least 30 plays. One month without a leader inside an era is bridged.

**Response:**

- `200`: Object with the first and last month with plays (`YYYY-MM` in the stats timezone), `artists` (each with its most played song during the era) and `genres` (each with its 3 most played artists), oldest first

#### `GET /spotify/story/loyal`

Get the 20 songs and 20 artists played in the most different months (months in the stats timezone), the most played first on ties.

**Response:**

- `200`: Object with `tracks` and `artists`, each with the number of months, total plays, first month (`YYYY-MM`) and plays per year

#### `GET /spotify/on-this-day`

Get today's date (in the stats timezone) in earlier years: for each year with plays that day, newest first, the day's plays and its most played song (the first one played on ties).

**Response:**

- `200`: Object with `today` (`YYYY-MM-DD`) and `years`

### Collaborative Features

#### `GET /spotify/collaborative/top/songs`

Get shared top songs between multiple users.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)
- `otherIds`: string[] - Array of other user IDs to compare with
- `mode`: string - Collaboration mode (intersection, union)

**Response:**

- `200`: Array of shared top songs

#### `GET /spotify/collaborative/top/albums`

Get shared top albums between multiple users.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)
- `otherIds`: string[] - Array of other user IDs to compare with
- `mode`: string - Collaboration mode (intersection, union)

**Response:**

- `200`: Array of shared top albums

#### `GET /spotify/collaborative/top/artists`

Get shared top artists between multiple users.

**Query Parameters:**

- `start`: date - Start date
- `end`: date - End date (defaults to current time)
- `timeSplit`: string - Time unit for grouping (day, week, month, year)
- `otherIds`: string[] - Array of other user IDs to compare with
- `mode`: string - Collaboration mode (intersection, union)

**Response:**

- `200`: Array of shared top artists

## Search

#### `GET /search/:query`

Search across tracks, artists and albums.

**Parameters:**

- `query`: Search term (3-64 characters)

**Response:**

```json
{
  "artists": Artist[],
  "tracks": Track[],
  "albums": Album[]
}
```

## Artist

#### `GET /artist/:ids`

Get artist details.

**Parameters:**

- `ids`: Comma-separated artist IDs

#### `GET /artist/:id/stats`

Get artist statistics.

**Parameters:**

- `id`: Artist ID

**Response:**

```json
{
  "artist": ArtistObject,
  "firstLast": FirstLastObject,
  "mostListened": [{ "_id": string, "count": number, "track": TrackObject }],
  "albumMostListened": [{ "_id": string, "count": number, "album": AlbumObject }],
  "total": TotalStats
}
```

`mostListened` and `albumMostListened` each contain up to ten entries. `total` includes `primaryCount` and `featuredCount`. The redesign removed `bestPeriod`; `dayRepartition` is not returned. Use `GET /spotify/timeline?type=artist&id=SPOTIFY_ID` for the listening timeline. When there are no usable listening statistics, the response is `{ "code": "NEVER_LISTENED" }` instead.

#### `GET /artist/search/:query`

Search for artists by name.

**Parameters:**

- `query`: Search term (3-64 characters)

**Response:**

- `200`: Array of matching artists

#### `POST /artist/blacklist/:id`

Blacklist an artist.

#### `POST /artist/unblacklist/:id`

Remove artist from blacklist.

#### `GET /artist/:id/rank`

Get artist's ranking among all artists.

**Parameters:**

- `id`: Artist ID

**Response:**

- Artist ranking information

## Album

#### `GET /album/:ids`

Get album details.

**Parameters:**

- `ids`: Comma-separated album IDs

#### `GET /album/:id/stats`

Get album statistics.

**Parameters:**

- `id`: Album ID

**Response:**

```json
{
  "album": AlbumObject,
  "artists": Artist[],
  "firstLast": FirstLastObject,
  "tracks": Track[]
}
```

#### `GET /album/:id/rank`

Get album's ranking among all albums.

**Parameters:**

- `id`: Album ID

**Response:**

- Album ranking information

## Track

#### `GET /track/:ids`

Get track details.

**Parameters:**

- `ids`: Comma-separated track IDs

#### `GET /track/:id/stats`

Get track statistics.

**Parameters:**

- `id`: Track ID

**Response:**

```json
{
  "track": TrackObject,
  "artists": Artist[],
  "album": AlbumObject,
  "listenedOn": [{ "_id": string, "count": number, "album": AlbumObject }],
  "firstLast": FirstLastObject,
  "recentHistory": HistoryObject,
  "total": TotalStats
}
```

`artists` follows the track's credit order. `listenedOn` contains the album versions actually played, with their listen counts. The redesign removed `bestPeriod`; use `GET /spotify/timeline?type=track&id=SPOTIFY_ID` for the listening timeline. When the track has no listens, the response is `{ "code": "NEVER_LISTENED" }` instead.

#### `GET /track/:id/rank`

Get track's ranking among all tracks.

**Parameters:**

- `id`: Track ID

**Response:**

- Track ranking information

## Import

#### `POST /import/privacy`

Import privacy data.

**Body:**

- Multipart form with files named "imports"

**Response:**

```json
{
  "code": "IMPORT_STARTED" | "IMPORT_INIT_FAILED"
}
```

#### `POST /import/retry`

Retry failed import.

**Body:**

```json
{
  "existingStateId": string
}
```

#### `DELETE /import/clean/:id`

Clean up import.

**Parameters:**

- `id`: Import ID

#### `GET /imports`

Get import status.

## Global Preferences

#### `GET /global/preferences`

Get global application preferences.

#### `POST /global/preferences`

Update global preferences (admin only).

**Body:**

```json
{
  "allowRegistrations": boolean
}
```

## Account Settings

#### `POST /settings`

Update user settings.

**Body:**

```json
{
  "historyLine": boolean?,
  "preferredStatsPeriod": "day" | "week" | "month" | "year"?,
  "nbElements": number?, // 5-50
  "metricUsed": "number" | "duration"?,
  "darkMode": "follow" | "dark" | "light"?,
  "timezone": string?,
  "dateFormat": string?
}
```

#### `POST /generate-public-token`

Generate new public access token.

#### `POST /delete-public-token`

Delete public access token.
