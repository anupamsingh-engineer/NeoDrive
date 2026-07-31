# Storage App

A Google-Drive-style file storage app — React frontend, Node/Express backend, direct-to-S3
uploads, CloudFront-signed downloads, MongoDB Atlas, Redis, and BullMQ background jobs. This is
a two-package monorepo: [`backend/`](./backend) and [`frontend/`](./frontend) each have their own
README, docs, and deployment path — this file is the map between them.

## How it fits together

```mermaid
flowchart TB
    User["User's browser"]

    subgraph FE["Frontend — React SPA (static build)"]
        direction TB
        FECF["CloudFront\n(frontend hosting)"]
        FES3[("S3\nfrontend static build")]
        FECF --> FES3
    end

    subgraph BE["Backend — Node/Express API + Worker (EC2, Docker)"]
        direction TB
        API["API process\n(server.js)"]
        Worker["Worker process\n(worker.js)"]
    end

    subgraph Data["Data & Infra"]
        direction TB
        Mongo[("MongoDB Atlas")]
        Redis[("Redis")]
        FileS3[("S3\nuser files")]
        FileCF["CloudFront\n(file downloads)"]
        FileCF --> FileS3
    end

    User -->|"1 load the app"| FECF
    User -->|"2 API calls (cookies)"| API
    User -->|"3 direct file upload"| FileS3
    User -->|"4 direct file download"| FileCF

    API --> Mongo
    API --> Redis
    API -->|presigned URLs, HEAD checks| FileS3
    API -->|enqueue jobs| Redis
    Redis -->|jobs consumed| Worker
    Worker --> Mongo
    Worker --> FileS3
    Worker -->|send email| Resend["Resend API"]
```

Two separate S3/CloudFront pairs, on purpose: one hosts the frontend's static build, the other
stores and serves user files. Neither the frontend's static assets nor a user's uploaded files
ever pass through the API server itself — steps 1, 3, and 4 above go straight to S3/CloudFront;
only step 2 (actual API calls — auth, directory/file metadata, presigned-URL requests) hits the
backend.

This is the *runtime* picture. For the full request-by-request detail — auth, directory/file
operations, signed URLs, caching, queues on the backend; bootstrap, the Redux/RTK Query store,
routing, upload on the frontend — see each package's own **Flow Diagrams**, linked below.

---

## Backend

Node/Express API: dual-JWT cookie auth with refresh rotation and reuse detection, RBAC, a
directory/file tree with atomic quota reservation, two-phase S3 uploads, CloudFront-signed
downloads, Redis cache-aside, BullMQ background jobs (email, S3 cleanup, nightly size
reconciliation), and a full observability stack (pino, Prometheus, OpenTelemetry).

- **[backend/README.md](./backend/README.md)** — setup, scripts, architecture summary, and the
  backend's own embedded **[Flow Diagrams](./backend/README.md#flow-diagrams)**
- **[backend/docs/index.md](./backend/docs/index.md)** — one doc per feature: auth, users,
  directories, files, subscriptions/webhooks, background jobs, caching, security, observability,
  error handling, plus a flat [API reference](./backend/docs/api-reference.md)
- **[backend/docs/flow-diagrams.md](./backend/docs/flow-diagrams.md)** ·
  [Artifact ↗](https://claude.ai/code/artifact/d2fad691-e000-4b18-9463-b81fb05db9f9)
- Deployment: [EC2 + Docker + nginx + Let's Encrypt](./backend/docs/ec2-deployment.md)

```bash
cd backend
npm install
cp .env.example .env   # fill in secrets, including a MongoDB Atlas DB_URL
npm run dev:all         # Redis (Docker) + migrations + API + worker, one command, hot reload
```

## Frontend

React 19 + Redux Toolkit/RTK Query client: cookie-based auth (no client-readable token
anywhere), a from-scratch UI component library on Tailwind CSS v4, a 3-step signup wizard that
survives a page reload, direct-to-S3 upload with progress, and a multi-provider analytics module.

- **[frontend/README.md](./frontend/README.md)** — setup, scripts, stack summary, and the
  frontend's own embedded **[Flow Diagrams](./frontend/README.md#flow-diagrams)**
- **[frontend/docs/index.md](./frontend/docs/index.md)** — one doc per concern: auth, routing,
  state/API, file management, analytics, styling, environment variables, build & deploy,
  contributing
- **[frontend/docs/flow-diagrams.md](./frontend/docs/flow-diagrams.md)** ·
  [Artifact ↗](https://claude.ai/code/artifact/1482b2f2-a52d-410f-a2eb-e3ff7a039c15)
- Deployment: [S3 + CloudFront + ACM + GitHub Actions](./frontend/docs/s3-cloudfront-deployment.md)

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_API_BASE_URL etc.
npm run dev                   # http://localhost:5173
```

Run both at once (two terminals): backend's `npm run dev:all` in `backend/`, frontend's
`npm run dev` in `frontend/` — the frontend expects the backend at `http://localhost:4000` by
default.

---

## Deployment

Each package deploys independently, to different infrastructure, via its own GitHub Actions
workflow — both live at the repo root (`.github/workflows/`, the only place GitHub Actions looks)
and are scoped with an `on.push.paths` filter so a change to one package never triggers the
other's pipeline:

| | Backend | Frontend |
|---|---|---|
| Target | EC2 (Docker Compose) | S3 (private, OAC) + CloudFront |
| Workflow | `.github/workflows/deploy-backend.yml` | `.github/workflows/deploy-frontend.yml` |
| Triggers on | `backend/**` | `frontend/**` |
| Guide | [backend/docs/ec2-deployment.md](./backend/docs/ec2-deployment.md) | [frontend/docs/s3-cloudfront-deployment.md](./frontend/docs/s3-cloudfront-deployment.md) |

See [frontend/docs/build-and-deploy.md#how-two-workflows-share-one-repo](./frontend/docs/build-and-deploy.md#how-two-workflows-share-one-repo)
for exactly how the path-filtering works.

## Full stack locally, via Docker

```bash
npm run docker:up      # first run / after a backend code change - rebuilds the image
npm run docker:start   # subsequent runs
npm run docker:down    # stop everything
```

This is a thin root-level wrapper (`docker-compose.yml` → `include:` → `backend/docker-compose.yml`)
— it brings up the backend's API/worker/Redis/observability stack (MongoDB is Atlas, not
containerized). The frontend isn't part of this — run it separately with `npm run dev` in
`frontend/`, or build+deploy it to S3/CloudFront per the guide above.
