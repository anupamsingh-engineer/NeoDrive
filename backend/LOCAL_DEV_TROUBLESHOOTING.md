# Local Dev Setup & Troubleshooting

Commands to get the backend actually running locally, plus every error hit while setting this
up and the exact fix for each. Read the "Quick start" once, then use the error table to jump
straight to a fix when something breaks.

## Quick start (hybrid: Docker for Mongo/Redis, native `npm run dev` for hot reload)

```bash
# 1. If you have a native MongoDB Windows service, stop it first - it fights with the Docker
#    container over port 27017 (from an elevated PowerShell):
Stop-Service MongoDB
Set-Service MongoDB -StartupType Manual

# 2. Start Docker Desktop (the app itself, not just the CLI), then bring up Mongo + Redis:
cd backend
docker compose up mongo redis -d

# 3. Initialize the MongoDB replica set - one-time, only needed the first time this Docker
#    volume is created (register/Google-login use a transaction, which requires a replica set):
docker compose up mongo-init

# 4. Only if the app itself runs natively on the host (not inside Docker): reconfigure the
#    replica set's advertised member address from the Docker-internal hostname to localhost,
#    since a natively-running app can't resolve "mongo". One-time per fresh volume.
mongosh mongodb://localhost:27017 --eval '
  const cfg = rs.conf();
  cfg.members[0].host = "localhost:27017";
  cfg.version += 1;
  rs.reconfig(cfg);
'

# 5. Install deps, configure env, run migrations
npm install
cp .env.example .env   # then fill in real secrets
npm run migrate:up

# 6. Start the app
npm run dev
```

## Common errors and fixes

| Error                                                                                                                   | Cause                                                                                                                                                                                                                 | Fix                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Transaction numbers are only allowed on a replica set member or mongos`                                              | MongoDB is running standalone, not as a replica set                                                                                                                                                                   | Steps 1-4 above                                                                                                                                                                           |
| `MongoParseError: Invalid scheme, expected connection string to start with "mongodb://"`                              | Typo in`DB_URL` (e.g. an accidentally duplicated key: `DB_URL=DB_URL=mongodb://...`)                                                                                                                              | Check`.env` - should be exactly `DB_URL=mongodb://localhost:27017/storage-app?replicaSet=rs0`                                                                                         |
| `MongooseServerSelectionError ... ReplicaSetNoPrimary ... servers: {}`                                                | Replica set was never initialized -`mongo-init` never ran                                                                                                                                                           | `docker compose up mongo-init`                                                                                                                                                          |
| `getaddrinfo ENOTFOUND mongo`                                                                                         | Replica set's member address is the Docker-internal hostname`mongo:27017`, but the app runs natively on the host, which can't resolve that hostname                                                                 | Run the`rs.reconfig()` command in step 4                                                                                                                                                |
| Flaky/intermittent replica set errors, or`docker compose up mongo` succeeds but `mongosh` hits a different instance | A native`mongod.exe` Windows service **and** the Docker container are both bound to port 27017 at the same time                                                                                               | Stop the native service (step 1); verify with`Get-NetTCPConnection -LocalPort 27017` that only Docker owns it                                                                           |
| CloudFront`Invalid URI scheme. Scheme must be one of http, https, or rtmp`                                            | `CLOUDFRONT_DOMAIN` in `.env` is missing the `https://` prefix                                                                                                                                                  | Must be`CLOUDFRONT_DOMAIN=https://xxxxx.cloudfront.net`, not the bare hostname                                                                                                          |
| `docker compose` fails with `unexpected character "+" in variable name "..."`                                       | `.env`'s `CLOUDFRONT_PRIVATE_KEY` has real multi-line PEM content - Docker Compose's own `.env` parser (used for its variable substitution, separate from Node's `--env-file`) can't handle multi-line values | Store the private key as a single line with literal`\n` escapes instead of real line breaks (see `.env.example`) - `src/config/env.js` converts it back to real newlines at startup |
| `unable to get image ... failed to connect to the docker API ... dockerDesktopLinuxEngine`                            | Docker Desktop the application isn't running (only the CLI is installed)                                                                                                                                              | Launch Docker Desktop and wait for its tray icon to show "running" (10-30s) before retrying                                                                                               |
| Backend won't pick up a`.env` change after editing it                                                                 | `npm run dev` uses `node --watch`, which only reloads on JS file changes, not `.env`                                                                                                                            | Manually stop (`Ctrl+C`) and re-run `npm run dev`                                                                                                                                     |

## Verify replica set health directly

```bash
mongosh mongodb://localhost:27017 --eval "rs.status().members.map(m => ({name: m.name, stateStr: m.stateStr}))"
# Expect: [ { name: 'localhost:27017', stateStr: 'PRIMARY' } ]
```

## Full stack instead (app + worker also run in Docker)

```bash
docker compose up --build
```

- API: http://localhost:4000 · Prometheus: http://localhost:9090 · Grafana: http://localhost:3001 · Jaeger: http://localhost:16686

Do **not** run the `rs.reconfig()` step (step 4) in this mode - the containers correctly resolve
`mongo:27017` via Docker's internal DNS, and reconfiguring to `localhost:27017` would break it
for them instead.
