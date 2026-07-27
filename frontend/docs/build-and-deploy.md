# Build & Deploy

Code: `vite.config.js`, `Dockerfile`, `nginx.conf`, `.dockerignore`, `index.html`.

## Local build

```bash
npm run build      # → dist/
npm run preview    # serve dist/ locally to sanity-check the production build
```

Vite manually splits vendor chunks for caching (`vite.config.js`):
`vendor-react` (react/react-dom), `vendor-redux` (@reduxjs/toolkit + react-redux),
`vendor-router` (react-router-dom), `vendor-persist` (redux-persist) — application code is a
separate chunk, further split per-route automatically since every page is `React.lazy()`-loaded
(see [routing-and-pages.md](./routing-and-pages.md)). Minification is `esbuild` (built into Vite;
the alternative, `terser`, would need a separate install this project doesn't have). Source maps
are opt-in via `VITE_SOURCEMAP=true`.

## `VITE_*` vars are baked in, not runtime-configurable

This is the one thing that trips people up coming from a Node/backend deploy model: Vite replaces
every `import.meta.env.VITE_*` reference with its literal value **at build time**. There is no
`.env` file read by the running container — by the time `dist/` exists, the values are already
inlined into the JS. Changing `VITE_API_BASE_URL` (or any other `VITE_*` var) after building means
**rebuilding the image**, not restarting a container or editing a config file on the server. See
[environment-variables.md](./environment-variables.md) for the full list.

`index.html`'s CSP `<meta>` tag uses a different mechanism for the same problem —
`%VITE_API_ORIGIN%` is Vite's HTML env-variable placeholder syntax, replaced at build time too
(not runtime), so the CSP's `connect-src`/`img-src`/`media-src` end up pointing at the real API
origin without a second templating system.

## Docker image (multi-stage)

```dockerfile
FROM node:20-alpine AS builder
...
ARG VITE_API_BASE_URL
ARG VITE_API_ORIGIN
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_RAZORPAY_KEY_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL ...
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Because the `VITE_*` vars must be baked in (see above), they're passed as Docker **build args**,
not container environment variables:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.storage.anupamsingh.xyz/ \
  --build-arg VITE_API_ORIGIN=https://api.storage.anupamsingh.xyz \
  --build-arg VITE_GOOGLE_CLIENT_ID=<...> \
  --build-arg VITE_RAZORPAY_KEY_ID=<...> \
  -t storage-app-frontend .
```

The final image is just `nginx:1.27-alpine` serving a static `dist/` folder — no Node process runs
in the runtime container at all.

## `nginx.conf`

Three concerns, all handled inside the container's nginx (separate from any reverse-proxy nginx
in front of it — see the deployment note below):

1. **SPA fallback**: `try_files $uri $uri/ /index.html` — any path nginx doesn't recognize as a
   real file falls through to `index.html`, so React Router's client-side routes (e.g.
   `/app/drive/abc123`) work on a hard refresh or direct link instead of 404ing.
2. **Cache strategy split**: hashed build assets under `/assets/` (`[name].[hash].js/css`) get
   `Cache-Control: public, immutable` with a 1-year expiry — safe, since a new deploy produces new
   hashed filenames. `index.html` itself gets `Cache-Control: no-cache` — it must always be
   revalidated, or a client could keep loading an old bundle's now-deleted hashed asset URLs
   after a new deploy.
3. **Security headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin` on every location block (nginx's
   `add_header` doesn't inherit into a location that sets its own, so it's repeated per-block
   rather than declared once).

## Content-Security-Policy

Set as a `<meta http-equiv="Content-Security-Policy">` tag in `index.html` (not an HTTP header —
see the code comment there for why `X-Frame-Options`/`X-Content-Type-Options` are *also* set as
real headers in `nginx.conf`: browsers ignore those two specifically when set via `<meta>`).
Scoped tightly to exactly what this app loads:

- `script-src`: self + Google Identity Services + Razorpay Checkout
- `connect-src`: self + the backend API (`%VITE_API_ORIGIN%`) + S3 (direct browser-to-S3 uploads,
  see [file-management.md](./file-management.md)) + Google + Razorpay
- `frame-src`: Google + Razorpay (both render an iframe for their respective flows)
- `img-src`/`media-src`: self + the API origin (file previews/thumbnails proxy through
  CloudFront via the backend's signed URLs — see
  [backend files.md](../../backend/docs/files.md#get-fileidactiondownload))

If you add a new third-party script (analytics providers beyond PostHog/Mixpanel/Hotjar, a
payment provider, etc. — see [analytics.md](./analytics.md#ga4gtm-script-loading--also-not-wired-yet)),
it needs a corresponding CSP entry here or the browser will silently block it.

## Production deployment: S3 + CloudFront

This app deploys as a static site — S3 (private, via Origin Access Control) behind CloudFront,
TLS from an ACM certificate on `storage.anupamsingh.xyz`, redeployed automatically by GitHub
Actions on every push to `frontend/**`. The Docker image and `nginx.conf` above are still real and
useful (local `docker compose` testing, or an alternative container-based deploy target), but
**production uses the static-hosting path, not this container** — the Dockerfile isn't part of
the S3/CloudFront pipeline at all; only `npm run build`'s `dist/` output is.

Full step-by-step guide, including the one-time AWS setup (S3 bucket, ACM certificate — which
**must** be requested in `us-east-1` for CloudFront regardless of your other resources' region,
CloudFront distribution with SPA-routing error pages, IAM least-privilege deploy user) and the
GitHub Actions workflow itself:
**[s3-cloudfront-deployment.md](./s3-cloudfront-deployment.md)**.

This repo's backend, by contrast, deploys as a container on EC2 — see
[../../backend/docs/ec2-deployment.md](../../backend/docs/ec2-deployment.md), serving
`api.storage.anupamsingh.xyz`. Two completely different deployment models, two separate GitHub
Actions workflows, living side by side in the same repo — see below for how each only fires for
its own half.

## How two workflows share one repo

Both deploy workflows live at the repo root, `.github/workflows/` — `deploy-frontend.yml` and
`deploy-backend.yml` (in `../../backend/docs/ec2-deployment.md`). **This is the only place GitHub
Actions ever looks for workflow files** — a `.github/workflows/` folder nested inside `frontend/`
or `backend/` would silently never run (this repo's backend workflow originally lived at
`backend/.github/workflows/main.yml` and was moved to the root for exactly this reason).

By default, `on: push: branches: [main]` fires a workflow for **every** push to that branch,
regardless of which files changed — a docs typo fixed in `backend/` would otherwise also rebuild
and redeploy the frontend, and vice versa. Both workflows add an `on.push.paths` filter to scope
themselves to their own half of the repo:

```yaml
# deploy-frontend.yml
on:
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/deploy-frontend.yml"
```

```yaml
# deploy-backend.yml
on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"
```

GitHub evaluates `paths` against the full list of files changed in the push (across all commits
being pushed, not just the latest one) — if **at least one** changed file matches a `paths`
pattern, that workflow runs; if none match, it's skipped entirely (shows as "skipped", not
"failed", in the Actions tab). A commit that touches both `frontend/` and `backend/` in the same
push triggers both workflows, independently and in parallel — there's no coordination between
them, which is correct here since they deploy to entirely separate infrastructure (S3/CloudFront
vs. EC2) that doesn't need to move in lockstep.

The workflow file itself is included in its own `paths` list so that editing the workflow's
logic — not just app code — also triggers a run, letting you verify a workflow change actually
works without needing an unrelated app-code change to trigger it.
