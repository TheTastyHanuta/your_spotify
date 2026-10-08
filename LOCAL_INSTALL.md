# Local installation (without Docker)

## Prerequisites

You will need:

- A clone of this repository: `git clone https://github.com/TheTastyHanuta/your_spotify.git`
- A running MongoDB database
- Node.js (the repository's Docker images use Node 25; with nvm, run `nvm install 25` and `nvm use 25`)
- pnpm available in your selected Node installation

From the repository root, install the workspace dependencies once:

```bash
pnpm install --frozen-lockfile
```

Follow the [main README](README.md#installation) to choose your endpoints and configure the Spotify application. If testing an unmerged feature, check out its branch before installing and building.

## Hosting backend

Go to `apps/server` and build:

```bash
cd apps/server
pnpm build
```

Create an `.env` file there with your server configuration, for example:

```dotenv
API_ENDPOINT=http://127.0.0.1:8080
CLIENT_ENDPOINT=http://127.0.0.1:3000
MONGO_ENDPOINT=mongodb://127.0.0.1:27017/your_spotify
SPOTIFY_PUBLIC=your_spotify_client_id
SPOTIFY_SECRET=your_spotify_client_secret
NODE_ENV=production
```

See the [environment variable table](README.md#environment-variables) for the remaining options, including `PORT` (default `8080`). Set `MONGO_ENDPOINT` explicitly: the server's default uses the Docker hostname `mongo`.

Back up an existing database before running migrations. From `apps/server`, run migrations and then start the server with the same environment:

```bash
node --env-file=.env build/index.js --migrate
node --env-file=.env build/index.js
```

Repeat the migration command before starting an updated build. Unlike the Docker entrypoint, starting the server directly does not run migrations automatically. The optional [ISRC deduplication](apps/server/ISRC_DEDUPLICATION.md) is a separate manual operation.

## Hosting client

From the repository root:

```bash
cd apps/client
pnpm build
cp build/variables-template.js build/variables.js
```

In `build/variables.js`, replace `__API_ENDPOINT__` with your backend's URL. In `build/index.html`, update the Content Security Policy's `connect-src` URL to the same API URL (with a trailing `/`), and update the social preview image URLs if needed. Repeat these edits after each rebuild. The Docker startup script performs these substitutions automatically; local builds do not.

Serve the entire `apps/client/build` directory, including its font files. The redesign bundles fonts locally, so no external font service or `data:` font permission is needed.

Configure your web server to serve `index.html` for application routes such as `/history` and `/habits`, while serving existing assets normally. The client handles unknown application routes with a **Page not found** page. An `.htaccess` file is included for Apache.

### Using systemd user unit

You can have MongoDB and the backend running through systemd user units.

- Create a systemd unit file in your home directory at `.config/systemd/user/` (create the folders if they don't exist) and name it something like `your_spotify.service`.

For the backend, use the following template. Replace `YOUR_USER` and `YOUR_NODE_VERSION` with your paths; `nvm which current` gives the Node executable to use. systemd does not load nvm from your shell profile.

```
[Unit]
Description=Your Spotify Backend
Wants=network-online.target mongodb.service
After=syslog.target network.target nss-lookup.target network-online.target

[Service]
EnvironmentFile=/home/YOUR_USER/sites/applications/spotify/your_spotify/apps/server/.env
ExecStart=/home/YOUR_USER/.nvm/versions/node/YOUR_NODE_VERSION/bin/node build/index.js
StandardOutput=journal
Restart=on-failure
WorkingDirectory=/home/YOUR_USER/sites/applications/spotify/your_spotify/apps/server

[Install]
WantedBy=multi-user.target
```

The environment file contains `NAME=value` lines, without `export`. Run migrations manually before starting the service after an update. Adjust `mongodb.service` if your database uses a different service name or runs outside your user services.

Example MongoDB version of the systemd unit file:

```
[Unit]
Description=MongoDB
Wants=network-online.target
After=syslog.target network.target nss-lookup.target network-online.target

[Service]
Type=forking
ExecStart=/home/YOUR_USER/filesystem/bin/mongod --dbpath /home/YOUR_USER/filesystem/var/lib/mongo --logpath /home/YOUR_USER/filesystem/var/log/mongodb/mongod.log --fork --bind_ip 127.0.0.1 --port 40097
StandardOutput=journal
Restart=on-failure
WorkingDirectory=/home/YOUR_USER/filesystem/

[Install]
WantedBy=multi-user.target
```

- Enable the services and start them with `systemctl --user --now enable mongodb` and `systemctl --user --now enable your_spotify`.
- If using the example MongoDB unit above, set `MONGO_ENDPOINT=mongodb://127.0.0.1:40097/your_spotify` in the backend environment file to match its port.
- The backend should have started up properly.
