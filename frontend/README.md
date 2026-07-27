# Storage App Frontend

React 19 + Redux Toolkit/RTK Query client for the Storage App API (`../backend`) — file/folder
storage with cookie-based auth, direct-to-S3 uploads, CloudFront-signed downloads, and Razorpay
subscriptions.

**Looking for how a specific part of this app actually works?** See
**[docs/](./docs/index.md)** — auth/session handling, routing, state management, the file upload
flow, analytics, styling, environment variables, and build/deploy, all verified against the real
code (not the generic template this project started from).

## Stack

- **React 19** with Redux Toolkit + RTK Query (server state lives entirely in the RTK Query
  cache — see [docs/state-and-api.md](./docs/state-and-api.md))
- **React Router v7**, every page lazy-loaded (see [docs/routing-and-pages.md](./docs/routing-and-pages.md))
- **Cookie-based auth** — both JWTs are httpOnly cookies the frontend never reads; only a
  JS-visible CSRF cookie is used, mirrored into a request header on mutations (see
  [docs/authentication.md](./docs/authentication.md))
- **Tailwind CSS v4** (CSS-first `@theme` config, no `tailwind.config.js`) + a from-scratch UI
  component library (no external UI kit) + framer-motion (see [docs/styling.md](./docs/styling.md))
- **Vite** for dev/build; production deploys as a static site on **S3 + CloudFront** with a
  custom domain and ACM-issued TLS (see
  [docs/s3-cloudfront-deployment.md](./docs/s3-cloudfront-deployment.md)); Docker + nginx also
  available for local/alternative container-based serving (see
  [docs/build-and-deploy.md](./docs/build-and-deploy.md))

## Setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_API_BASE_URL etc. — see docs/environment-variables.md
npm run dev                   # http://localhost:5173
```

The backend must be running first (`../backend`, default `http://localhost:4000`) — see
[../backend/docs/installation.md](../backend/docs/installation.md) or
[../backend/README.md](../backend/README.md) to get it up via Docker.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR, `:5173` |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `npm run lint:fix` | ESLint |

## Full documentation

| Doc | What's in it |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | Folder map, render/bootstrap lifecycle, the patterns used throughout |
| [docs/authentication.md](./docs/authentication.md) | Cookie session bootstrap, login/register/Google, CSRF, token refresh, idle timeout, background session revalidation |
| [docs/routing-and-pages.md](./docs/routing-and-pages.md) | Full route tree, `AuthGuard` rules, role-gating, every page |
| [docs/state-and-api.md](./docs/state-and-api.md) | Redux/RTK Query setup, the 5 API slices, error handling, two real bugs worth knowing about |
| [docs/file-management.md](./docs/file-management.md) | The Drive page: two-phase upload with progress, preview, rename/delete |
| [docs/analytics.md](./docs/analytics.md) | The multi-provider analytics module, event catalog, and a real gap (tracking isn't called anywhere yet) |
| [docs/styling.md](./docs/styling.md) | Tailwind design tokens, the UI component library, motion primitives |
| [docs/environment-variables.md](./docs/environment-variables.md) | Every `VITE_*` var — including two that are wired but not actually read |
| [docs/build-and-deploy.md](./docs/build-and-deploy.md) | Vite build/chunking, Docker multi-stage build, `nginx.conf`, CSP, how the two repo-root GitHub Actions workflows avoid triggering each other |
| [docs/s3-cloudfront-deployment.md](./docs/s3-cloudfront-deployment.md) | Production deployment: S3 (private, OAC) + CloudFront + ACM SSL + GitHub Actions CI/CD |
| [docs/contributing.md](./docs/contributing.md) | Real conventions used in this codebase — how to add an endpoint/page, state rules, what not to do |

This app is the client half of a two-part system — see
**[../backend/docs/index.md](../backend/docs/index.md)** for the API it talks to (every request
payload, the auth/CSRF model from the server side, and the EC2/Docker/nginx production deployment
guide for the backend).
