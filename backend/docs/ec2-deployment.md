# Deploying to EC2 (Docker + nginx + Let's Encrypt + GitHub Actions)

End-to-end guide for running this backend in production on a single AWS EC2 instance: launch the
box, get the repo onto it, run the stack with Docker Compose, front it with nginx on
`api.storage.anupamsingh.xyz`, get a real TLS certificate via certbot, then wire up GitHub Actions
so every push redeploys automatically.

This is a **single-box** deployment — everything (API, worker, Redis, and optionally the
observability stack) runs as containers on one EC2 instance, with nginx installed directly on the
host (not containerized) acting as the TLS-terminating reverse proxy in front of it. MongoDB is
**not** part of this — the app connects out to MongoDB Atlas over the network (see
[installation.md](./installation.md)), so there's nothing to install or back up for the database
on this box.

```
Internet
  │  :443 (HTTPS) / :80 (HTTP → redirects to HTTPS)
  ▼
nginx (host, not containerized)  ── proxies to ──▶  127.0.0.1:4000 ──▶  app container
  │
  └─ certbot manages the TLS cert + auto-renewal

Docker Compose (backend/docker-compose.yml), all on one instance:
  app (:4000, published to 127.0.0.1 only) · worker · redis · migrate (one-shot)
  [optional] prometheus · grafana · jaeger — see "Instance sizing" below
                                                                              MongoDB Atlas (external)
```

---

## 0. Prerequisites

- An AWS account with permission to launch an EC2 instance and edit its security group.
- Control over the DNS zone for `storage.anupamsingh.xyz` (to add the `api` subdomain).
- Push access to this GitHub repo, and permission to add repo secrets (Settings → Secrets and
  variables → Actions) for the CI/CD step.
- Everything listed in [installation.md](./installation.md)'s prerequisites (S3/CloudFront,
  Resend, Razorpay, a MongoDB Atlas connection string) — you'll need real production values for
  `backend/.env` on the box, not local-dev placeholders.

---

## 1. Launch the EC2 instance

1. **AMI**: Ubuntu Server 22.04 LTS (x86_64).
2. **Instance type**: see [Instance sizing](#instance-sizing) below — `t3.small` is the practical
   minimum, `t3.medium` if you also want Prometheus/Grafana/Jaeger running on the same box.
3. **Key pair**: create or reuse one — this is the *EC2 access key*, used to SSH in as `ubuntu`,
   both by you and later by GitHub Actions. Keep the `.pem` file; you'll need it in step 2 and
   again in step 8.
4. **Network settings → Security group** — inbound rules:

   | Type | Port | Source | Why |
   |---|---|---|---|
   | SSH | 22 | your IP (or `0.0.0.0/0` if you don't have a static IP, but prefer restricting it) | admin access + GitHub Actions deploys |
   | HTTP | 80 | `0.0.0.0/0` | certbot's HTTP-01 challenge, and the redirect to HTTPS |
   | HTTPS | 443 | `0.0.0.0/0` | the actual API traffic |

   **Do not open port 4000 to the internet.** `docker-compose.yml` publishes the app container's
   port as `127.0.0.1:4000:4000` (loopback only) specifically so nginx is the only thing that can
   ever reach it, and nginx itself only listens on 80/443. This security group is still the
   important boundary, though — belt and suspenders, not either/or.

5. **Storage**: 20 GB gp3 is comfortable for the OS + Docker images + logs.
6. Launch it, note the **public IPv4 address** (or better, allocate an **Elastic IP** and
   associate it, so the address survives a stop/start — DNS in step 2 points at this).

### Instance sizing

Running the *full* `docker-compose.yml` (app + worker + redis + prometheus + grafana + jaeger)
plus nginx wants at least 4 GB RAM (`t3.medium`). If you're on a smaller/free-tier instance
(`t3.micro`/`t2.micro`, 1 GB RAM), start only what you need — Compose automatically brings up a
service's dependencies too, so this still gets you `redis` and the one-shot `migrate` job even
though they're not named explicitly:

```bash
docker compose up --build -d app worker
```

Add `prometheus grafana jaeger` to that command later if you resize the instance. The GitHub
Actions workflow in step 9 defaults to the minimal set for this reason — adjust it if you want the
full stack deployed automatically.

---

## 2. Point DNS at the instance

In whatever DNS provider hosts `anupamsingh.xyz`, add:

```
Type: A
Name: api.storage
Value: <EC2 public IPv4 or Elastic IP>
TTL:  300
```

This makes `api.storage.anupamsingh.xyz` resolve to the box. Give it a few minutes to propagate —
`dig api.storage.anupamsingh.xyz +short` should return the IP before you move on to certbot in
step 7 (it does an HTTP challenge against that hostname, so DNS has to already resolve).

---

## 3. SSH in and install Docker

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

Install Docker Engine + the Compose plugin (Ubuntu's own `docker.io`/`docker-compose` packages are
outdated — use Docker's official repo):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Run docker without sudo (log out/in once for this to take effect)
sudo usermod -aG docker ubuntu
```

Log out and back in (or `newgrp docker`), then confirm:

```bash
docker compose version
```

---

## 4. Authenticate with GitHub and clone the repo

Don't reuse your personal GitHub SSH key on the server. Generate a fresh, repo-scoped **deploy
key** on the EC2 box instead — read-only, and if the box is ever compromised, revoking it doesn't
touch your personal account.

```bash
ssh-keygen -t ed25519 -C "ec2-neodrive-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy that public key, then in GitHub: **repo → Settings → Deploy keys → Add deploy key** — paste
it, leave **"Allow write access"** unchecked (read-only is all a deploy needs), save.

Back on the box:

```bash
ssh-keyscan -H github.com >> ~/.ssh/known_hosts
git clone git@github.com:<your-username>/<your-repo>.git ~/neodrive
cd ~/neodrive/backend
```

(`~/neodrive` is the path referenced throughout the rest of this guide and in the GitHub
Actions workflow in step 9 — adjust if you clone somewhere else.)

---

## 5. Configure the environment

```bash
cp .env.example .env
nano .env   # or vim/whatever's on the box
```

Fill in **real production values** — this is the one step that's genuinely different from local
dev, not just a copy-paste:

| Var | Production value |
|---|---|
| `NODE_ENV` | `production` — flips cookie `secure`/`sameSite` to production settings (see [security.md](./security.md#cookie-configuration)) and suppresses internal error messages in 500 responses |
| `DB_URL` | your MongoDB Atlas connection string (see [installation.md](./installation.md)) |
| `CLIENT_URL_1` / `CLIENT_URL_2` | your real frontend origin(s) — this is the CORS allow-list, not a placeholder |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_SECRET` | long random values, **different from any dev secrets** — e.g. `openssl rand -hex 32` |
| `AWS_*`, `CLOUDFRONT_*`, `RESEND_*`, `RAZORPAY_*`, `GOOGLE_CLIENT_ID` | your real production credentials for each provider |

This `.env` file stays on the server permanently — it's git-ignored (see `.gitignore`) and is
**never** touched by `git pull` or the deploy workflow in step 9. You only edit it here, by hand,
when a secret changes.

---

## 6. Bring the stack up

From `~/neodrive` (the repo root — this uses the root `docker-compose.yml`, which just
`include:`s `backend/docker-compose.yml`, see that file's own comment for why):

```bash
cd ~/neodrive
docker compose up --build -d app worker
docker compose ps
```

`migrate` (index creation) and `redis` come up automatically as dependencies of `app`/`worker`
even though they're not named explicitly. Confirm the app answers locally before wiring up nginx:

```bash
curl -s http://127.0.0.1:4000/healthz
# {"status":"ok"}
```

If you sized the instance for the full observability stack too:
```bash
docker compose up --build -d
```

---

## 7. nginx reverse proxy

Install nginx and drop in the reference config committed at
[`backend/deploy/nginx/api.storage.anupamsingh.xyz.conf`](../deploy/nginx/api.storage.anupamsingh.xyz.conf):

```bash
sudo apt-get install -y nginx

sudo cp ~/neodrive/backend/deploy/nginx/api.storage.anupamsingh.xyz.conf \
        /etc/nginx/sites-available/api.storage.anupamsingh.xyz.conf
sudo ln -s /etc/nginx/sites-available/api.storage.anupamsingh.xyz.conf \
           /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # remove nginx's default placeholder site

sudo nginx -t     # validate config syntax
sudo systemctl reload nginx
```

At this point `http://api.storage.anupamsingh.xyz/healthz` should proxy through to the app
container (still plain HTTP — TLS comes next).

---

## 8. TLS via certbot (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot --nginx -d api.storage.anupamsingh.xyz
```

Certbot will:
- Prove domain ownership via an HTTP-01 challenge on port 80 (this is why port 80 stays open in
  the security group, and why DNS in step 2 has to already be resolving).
- Rewrite the nginx config in place to add a `listen 443 ssl` server block with the issued
  certificate, and (accept the prompt for this) add an HTTP→HTTPS redirect on port 80.
- Install a systemd timer (`certbot.timer`, already enabled by the package) that renews the
  certificate automatically before it expires — no cron job to set up by hand.

Verify:
```bash
curl -s https://api.storage.anupamsingh.xyz/healthz
sudo certbot renew --dry-run   # confirms auto-renewal will work when it actually runs
```

Your frontend's `VITE_API_BASE_URL`/`VITE_API_ORIGIN` (see
[frontend-integration-guide.md](./frontend-integration-guide.md)) and this backend's
`CLIENT_URL_1`/`CLIENT_URL_2` should now point at `https://api.storage.anupamsingh.xyz` and your
production frontend origin, respectively.

---

## 9. GitHub Actions: deploy on every push

The workflow lives at
[`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml) — at the
**repo root**, not `backend/.github/workflows/`, because GitHub Actions only ever scans
`.github/workflows/` at the top of the repository; it does not recurse into subfolders. This repo
also has a frontend deploy workflow (`.github/workflows/deploy-frontend.yml`, see
[frontend/docs/s3-cloudfront-deployment.md](../../frontend/docs/s3-cloudfront-deployment.md)) —
both live side by side at the root, and each only fires for its own half of the repo via an
`on.push.paths: ["backend/**"]` / `["frontend/**"]` filter. Push something that only touches
`frontend/`, and this backend workflow simply doesn't run (and vice versa) — see
[frontend/docs/build-and-deploy.md](../../frontend/docs/build-and-deploy.md#how-two-workflows-share-one-repo)
for the full explanation of how that detection works.

This workflow SSHes into the EC2 box using the *EC2 access key* from step 1 (not the GitHub
deploy key from step 4 — that one never leaves the box) and re-runs the same commands you ran by
hand in steps 4/6:

```
git pull --ff-only  →  docker compose up --build -d app worker  →  docker image prune -f
```

`migrate` runs again on every deploy as part of `docker compose up` (it's a one-shot `restart: "no"`
container — cheap to re-run, and it's what applies any new index migrations that shipped in the
push). `docker image prune -f` clears the previous build's now-dangling image layers so disk usage
doesn't grow unbounded across deploys.

### One-time setup: repo secrets

**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SSH_PRIVATE_KEY` | the contents of the **EC2 access key** `.pem` file from step 1 (`cat your-key.pem`) — this is what lets the Actions runner SSH in as `ubuntu`, distinct from the GitHub deploy key generated on the box in step 4 |
| `EC2_HOST` | the box's public IP or Elastic IP |
| `EC2_USER` | `ubuntu` |
| `EC2_APP_DIR` | `/home/ubuntu/neodrive` (or wherever you cloned it in step 4) |

Once those exist, every push to `main` (or a manual **Actions → Deploy NeoDrive Backend (Docker)
→ Run workflow**) redeploys automatically. Watch it under the repo's **Actions** tab.

### If a deploy fails

SSH in and check directly — the workflow just runs the same commands you'd run by hand:
```bash
cd ~/neodrive
docker compose logs -f app worker   # or: npm run docker:logs, from backend/
docker compose ps
```

---

## 10. (Optional) Expose Grafana via metric.neodrive.anupamsingh.xyz

Only relevant if you resized to run the full observability stack (see "Instance sizing" above).
By default Grafana is loopback-only (`127.0.0.1:3001`, see `docker-compose.yml`) — reachable
locally via `docker compose up -d prometheus grafana jaeger`, or remotely via a manual
`ssh -L 3001:localhost:3001` tunnel, without any of this section. Do this instead if you want a
real URL you can just open in a browser.

1. **Set a real admin password** — `GRAFANA_ADMIN_PASSWORD` in `.env` (see `.env.example`), then
   recreate the container so it picks it up: `docker compose up -d grafana`. Anonymous access is
   already off (see `docker-compose.yml`), so this password is the only way in once this is
   public — don't skip it or leave it as the compose fallback (`admin`).
2. **DNS** — same as step 2 above, but `Name: metric.neodrive` instead of `api.storage`, pointing
   at the same EC2 IP.
3. **nginx** — same as step 7 above, using
   [`backend/deploy/nginx/metric.neodrive.anupamsingh.xyz.conf`](../deploy/nginx/metric.neodrive.anupamsingh.xyz.conf)
   in place of the API's config file.
4. **TLS** — same as step 8 above: `sudo certbot --nginx -d metric.neodrive.anupamsingh.xyz`.

Verify: `https://metric.neodrive.anupamsingh.xyz` should show Grafana's login page (not a
dashboard directly — anonymous access is off, log in as `admin` with `GRAFANA_ADMIN_PASSWORD`).

If you later want to proxy Prometheus (`:9090`) the same way, be aware it has no built-in login of
its own — put nginx `auth_basic` in front of it, same as step 11 does for Jaeger below.

---

## 11. (Optional) Expose Jaeger via traces.neodrive.anupamsingh.xyz

Same idea as step 10, for the trace viewer. **Jaeger has no login of its own at all** — unlike
Grafana, there's no admin-password fallback, so nginx's `auth_basic` is the *only* thing gating
access once this is public. Don't skip it, and don't reuse this rule to also expose Prometheus/
Jaeger's port directly in the EC2 security group "to make it easier" — the loopback binding in
`docker-compose.yml` plus this nginx layer is the intended path in, not a firewall rule opening
the raw port to `0.0.0.0/0`.

1. **Create the password file** (one-time):
   ```bash
   sudo apt-get install -y apache2-utils
   sudo htpasswd -c /etc/nginx/.htpasswd-traces admin
   ```
2. **DNS** — same as step 2, `Name: traces.neodrive`, pointing at the same EC2 IP.
3. **nginx** — same as step 7, using
   [`backend/deploy/nginx/traces.neodrive.anupamsingh.xyz.conf`](../deploy/nginx/traces.neodrive.anupamsingh.xyz.conf).
4. **TLS** — `sudo certbot --nginx -d traces.neodrive.anupamsingh.xyz`.

Verify: `https://traces.neodrive.anupamsingh.xyz` should prompt for the `auth_basic` username/
password *before* showing anything, then land on the Jaeger UI.

---

## Redeploying manually (without pushing)

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd ~/neodrive
git pull --ff-only
docker compose up --build -d app worker
docker image prune -f
```

## Updating the TLS-facing nginx config later

If you ever change `backend/deploy/nginx/api.storage.anupamsingh.xyz.conf` in the repo, re-copy it
to `/etc/nginx/sites-available/` on the box and `sudo nginx -t && sudo systemctl reload nginx` —
copying the file is not part of the automated deploy (nginx itself isn't containerized/versioned
by this repo's Compose stack), so an nginx config change needs that one manual step.
