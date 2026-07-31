# Local Dev Setup & Troubleshooting

Commands to get the backend actually running locally, plus every error hit while setting this
up and the exact fix for each. Read the "Quick start" once, then use the error table to jump
straight to a fix when something breaks.

MongoDB is **not** run locally — the app connects to a MongoDB Atlas cluster over the network via
`DB_URL` (see [installation.md](./installation.md)). Only Redis needs to run locally, and it runs
in Docker; the API and worker run natively on the host for fast hot-reload iteration.

## Quick start (one command, after first-time setup)

```bash
cd backend
npm install
cp .env.example .env   # then fill in real secrets, including a MongoDB Atlas DB_URL

npm run dev:all
```

`dev:all` does everything in one shot: brings up `redis` in Docker (fast — no image build, just
starts a container if it isn't already running), runs `migrate:up` against your Atlas cluster
(safe to re-run every time — `migrate-mongo` skips migrations it's already applied), then starts
the API (`dev`) and worker (`worker:dev`) **concurrently in one terminal**, labeled `API`/`WORKER`
in different colors (via `concurrently`) so you can tell their log lines apart. Both run with
`node --watch`, so editing a source file hot-reloads that process in place — no Docker rebuild,
no restart by hand.

Stop everything with a single `Ctrl+C` — `concurrently` forwards it to both child processes.

This is dramatically faster than `npm run docker:up`/`docker compose up --build -d` for active
development: that path rebuilds a Docker image from scratch on every code change and has no hot
reload at all — reserve it for testing the actual production build/image, not day-to-day
iteration. See [installation.md](./installation.md) for that Docker-based path.

### Running the pieces separately instead

If you want the API and worker in separate terminals (e.g. to scroll one's logs without the
other's interleaved), skip `dev:all` and run these three instead:

```bash
docker compose up redis -d   # once per reboot - stays running in the background
npm run migrate:up            # after pulling new migrations, or just to be safe

# then, in two separate terminals:
npm run dev
npm run worker:dev
```

**Both the API and the worker are required** for the app to fully function — the worker is what
actually sends emails (OTP, password reset), cleans up S3 objects after a delete, and reconciles
directory sizes nightly; the API process only ever *enqueues* that work, never performs it. Run
`npm run dev` alone and OTP/password-reset emails will never arrive even though the API returns
success — see [background-jobs.md](./background-jobs.md).

## Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `querySrv ECONNREFUSED _mongodb._tcp....mongodb.net` | Your network's default DNS resolver doesn't correctly handle the `_mongodb._tcp.<host>` SRV lookup a `mongodb+srv://` URL requires (common with some ISP/router DNS, some VPNs) — `server.js`/`worker.js`/`migrate-mongo-config.cjs` all override the resolver to public DNS (`src/config/dns.cjs`) specifically to work around this, but each Node process has to load that override itself; if you're hitting this, one of them isn't | Confirm `DB_URL` in `.env` is correct first. If it is, and this is `npm run migrate:up` specifically: check `migrate-mongo-config.cjs` still has `require("./src/config/dns.cjs")` right after `require("dotenv/config")` — that's what applies the fix for migrate-mongo's own separate CLI process |
| `Transaction numbers are only allowed on a replica set member or mongos` | `DB_URL` points at a standalone (non-replica-set) MongoDB instance — `register`/Google sign-up use a transaction | Point `DB_URL` at an Atlas cluster (replica set by default) — or, if self-hosting Mongo instead, enable a replica set on it yourself; this repo no longer provisions one for you |
| `MongoParseError: Invalid scheme, expected connection string to start with "mongodb://"` | Typo in `DB_URL` (e.g. an accidentally duplicated key: `DB_URL=DB_URL=mongodb+srv://...`) | Check `.env` for a single, correct `DB_URL=mongodb+srv://...` line |
| CloudFront `Invalid URI scheme. Scheme must be one of http, https, or rtmp` | `CLOUDFRONT_DOMAIN` in `.env` is missing the `https://` prefix | Must be `CLOUDFRONT_DOMAIN=https://xxxxx.cloudfront.net`, not the bare hostname |
| `docker compose` fails with `unexpected character "+" in variable name "..."` | `.env`'s `CLOUDFRONT_PRIVATE_KEY` has real multi-line PEM content — Docker Compose's own `.env` parser (used for its variable substitution, separate from Node's `--env-file`) can't handle multi-line values | Store the private key as a single line with literal `\n` escapes instead of real line breaks (see `.env.example`) — `src/config/env.js` converts it back to real newlines at startup |
| `unable to get image ... failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop the application isn't running (only the CLI is installed) | Launch Docker Desktop and wait for its tray icon to show "running" (10-30s) before retrying |
| Backend won't pick up a `.env` change after editing it | `npm run dev`/`worker:dev` use `node --watch`, which only reloads on JS file changes, not `.env` | Stop (`Ctrl+C`) and re-run — `dev:all` restarts both at once |
| OTP/password-reset/etc. emails never arrive, but the API returns 201 with no error | Email sending happens in the **worker** process (BullMQ job consumer, `src/queues/email.worker.js`), not the API server — if you only ran `npm run dev`, or only restarted the API after a code change to `email.service.js`, the worker either isn't running or is still running old code | Use `npm run dev:all` so both always run together, or explicitly restart `npm run worker:dev` after any change to worker-side code |
| A code change to something the worker uses (e.g. `email.service.js`) doesn't seem to take effect | Same as above — the API and worker are two separate Node processes; restarting one doesn't restart the other | Restart the specific process that owns the changed code, or just use `dev:all` so a `Ctrl+C` + rerun restarts both together |
| `migrate-mongo` fails with `No \`url\` defined in config file!` even though `DB_URL` is set correctly | Newer Node versions can `require()` an ESM module directly, but migrate-mongo v11's config loader only expects that to throw and falls back to `import()` — it silently gets an unwrapped `{ default: {...} }` and never finds `mongodb.url` | Already fixed — config lives in `migrate-mongo-config.cjs` (plain CommonJS) and the `migrate:*` npm scripts pass `--file migrate-mongo-config.cjs` explicitly |

## Full stack instead (app + worker also run in Docker)

```bash
npm run docker:up      # first run / after a code change - rebuilds the image
npm run docker:start   # subsequent runs - skips the rebuild
```

No local Mongo/replica-set step needed here either — `app`/`worker`/`migrate` all connect straight
to Atlas via the `DB_URL` in `.env`. See [installation.md](./installation.md) for the full
walkthrough of this path, including the full-stack service list and verification checklist.
