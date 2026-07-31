# Deploying to S3 + CloudFront (custom domain, ACM SSL, GitHub Actions)

End-to-end guide for hosting this frontend as a static site: build with Vite, serve from a private
S3 bucket through CloudFront, terminate TLS with an ACM certificate on your own domain, and
redeploy automatically on every push via GitHub Actions.

This is a different deployment model from the backend's — there's no server, no Docker container,
no nginx process running anywhere. CloudFront edge nodes cache and serve static files directly
from S3; "deploying" just means uploading new files and telling CloudFront to stop serving the old
cached ones.

```
Internet
  │  https://storage.anupamsingh.xyz
  ▼
CloudFront (edge caching, TLS termination via ACM cert, SPA routing via custom error responses)
  │  Origin Access Control (OAC) - only CloudFront can read the bucket, it's not public
  ▼
S3 bucket (private) — holds the built dist/ output, nothing else

GitHub Actions, on every push to frontend/**:
  npm ci && npm run build  →  aws s3 sync dist/  →  aws cloudfront create-invalidation
```

Read this alongside [environment-variables.md](./environment-variables.md) (which `VITE_*` vars
the build needs) and [build-and-deploy.md](./build-and-deploy.md) (what's actually happening at
build time, and how this workflow avoids colliding with the backend's own deploy workflow in the
same repo).

---

## 0. Prerequisites

- An AWS account with permission to create S3 buckets, CloudFront distributions, ACM
  certificates, and IAM users/policies.
- Control over the DNS zone for `anupamsingh.xyz` (to add the `storage` subdomain).
- The backend already deployed and reachable over HTTPS (see
  [../../backend/docs/ec2-deployment.md](../../backend/docs/ec2-deployment.md)) — you'll need its
  real URL for the frontend's build-time env vars.
- Push access to this GitHub repo, and permission to add repo secrets.

---

## 1. Create the S3 bucket

Private bucket — **not** configured for static website hosting, and **not** publicly readable.
CloudFront reads it via an Origin Access Control (OAC), which is the current AWS-recommended
pattern (the older "public bucket + S3 website endpoint" approach works but leaves your bucket
directly, separately reachable over plain HTTP with no TLS).

```bash
aws s3api create-bucket \
  --bucket neodrive-frontend \
  --region us-east-1

aws s3api put-public-access-block \
  --bucket neodrive-frontend \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Bucket region doesn't have to be `us-east-1` — pick whatever's closest to you. The bucket stays
completely empty until the first GitHub Actions deploy runs (step 8) — there's nothing to upload
by hand here.

---

## 2. Request the ACM certificate — must be in `us-east-1`

**This is the single most common mistake with this setup**: CloudFront only accepts ACM
certificates issued in `us-east-1` (N. Virginia), *regardless of which region your S3 bucket, your
other AWS resources, or your usual working region is*. Requesting the cert in the wrong region is
the #1 reason people get stuck with a distribution that won't accept their certificate.

In the ACM console, switch the region selector to **US East (N. Virginia)**, then:

1. **Request a certificate** → Public certificate.
2. Domain name: `storage.anupamsingh.xyz`.
3. Validation method: **DNS validation** (recommended — no email round-trip, and it auto-renews
   forever as long as the validation CNAME record stays in place).
4. ACM gives you a CNAME record (name + value) to add at your DNS provider. Add it, then wait for
   the certificate's status to flip from "Pending validation" to **"Issued"** (a few minutes to
   ~30 min depending on your DNS provider's propagation time) before moving on — CloudFront won't
   let you attach a still-pending certificate.

---

## 3. Create the CloudFront distribution

Console-driven (the CLI's `create-distribution` needs a large hand-written JSON config; the
console wizard is genuinely the faster path for a one-time setup like this).

**Origin**:
- Origin domain: pick your `neodrive-frontend` bucket from the dropdown (CloudFront shows S3
  buckets specially here, not as a generic HTTP origin).
- Origin access: **Origin access control settings (recommended)** → create a new OAC → keep the
  default signing behavior. CloudFront will show you a bucket policy to apply — copy it (or use
  the equivalent one in step 4 below) and apply it to the bucket. This is what makes the private
  bucket in step 1 actually readable by CloudFront, and by nothing else.

**Default cache behavior**:
- Viewer protocol policy: **Redirect HTTP to HTTPS**.
- Allowed methods: GET, HEAD (this is a static site — no PUT/POST/DELETE ever goes through
  CloudFront to this origin).

**Settings**:
- Alternate domain name (CNAME): `storage.anupamsingh.xyz`.
- Custom SSL certificate: select the ACM certificate from step 2 (only shows up here once it's
  "Issued", and only if you requested it in `us-east-1`).
- Default root object: `index.html`.
- Price class: your call — "Use all edge locations" for best global performance, or restrict to
  fewer regions to cut cost if your users are concentrated in one area.

**Custom error responses** (this is what makes React Router's client-side routes work — without
it, a hard refresh or direct link to e.g. `/app/drive/abc123` 403s/404s instead of loading the
app, since no such object exists in the bucket):

| HTTP error code | Response page path | HTTP response code |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

(S3 returns 403, not 404, for a missing key on a private bucket accessed via OAC — both are
mapped here since the exact code can vary by origin/access configuration.)

Create the distribution. It takes 5–15 minutes to fully deploy to all edge locations the first
time — subsequent changes (like the ones GitHub Actions triggers via cache invalidation) are much
faster.

---

## 4. Bucket policy allowing CloudFront to read it

If you didn't copy the policy CloudFront offered you in step 3, here's the equivalent — replace
`<ACCOUNT_ID>` and `<DISTRIBUTION_ID>` with your own:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::neodrive-frontend/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```

Apply via **S3 console → bucket → Permissions → Bucket policy**, or:

```bash
aws s3api put-bucket-policy --bucket neodrive-frontend --policy file://bucket-policy.json
```

The `AWS:SourceArn` condition scopes this to *this specific distribution* — without it, any
CloudFront distribution in any AWS account could read your bucket, not just yours.

---

## 5. DNS

Point `storage.anupamsingh.xyz` at the CloudFront distribution's domain name (something like
`d1234abcdef8.cloudfront.net`, shown on the distribution's detail page):

- **Route 53**: create an **A record**, type **Alias**, target = the CloudFront distribution
  (Route 53 has first-class CloudFront alias support — no separate CNAME needed, and it's free).
- **Any other DNS provider**: add a **CNAME record**, `storage` → the CloudFront domain name.

```
Type: CNAME (or ALIAS/A, provider-dependent)
Name: storage
Value: d1234abcdef8.cloudfront.net
```

Give it a few minutes to propagate, then confirm `https://storage.anupamsingh.xyz` loads over TLS
before wiring up CI/CD — you'll be doing a manual first upload in step 7 to verify this end to
end, before letting GitHub Actions take over.

---

## 6. IAM: a least-privilege deploy user

Don't reuse a personal/admin AWS key for this. Create an IAM user scoped to exactly what the
GitHub Actions workflow needs — nothing else:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DeployAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::neodrive-frontend",
        "arn:aws:s3:::neodrive-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
    }
  ]
}
```

**IAM → Users → Create user** (no console access needed, programmatic access only) → attach the
policy above (inline, or as a customer-managed policy) → **Security credentials → Create access
key** → choose "Application running outside AWS" → save the Access Key ID and Secret Access Key
for step 8. This key can only touch this one bucket and this one distribution — a leak of it
can't reach anything else in your AWS account.

---

## 7. First upload — do it by hand once, to verify the pipeline before automating it

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://api.storage.anupamsingh.xyz/ \
VITE_API_ORIGIN=https://api.storage.anupamsingh.xyz \
VITE_GOOGLE_CLIENT_ID=<your-google-client-id> \
VITE_RAZORPAY_KEY_ID=<your-razorpay-key-id> \
npm run build

aws s3 sync dist/ s3://neodrive-frontend/ --delete \
  --cache-control "public, max-age=31536000, immutable" --exclude "index.html"
aws s3 cp dist/index.html s3://neodrive-frontend/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

Load `https://storage.anupamsingh.xyz` — you should see the actual app (Login/Home page), not a
blank page or an S3 XML error. Check the browser console for CSP violations too — `index.html`'s
CSP `connect-src` needs to actually match `VITE_API_ORIGIN` (see
[build-and-deploy.md](./build-and-deploy.md#content-security-policy)); if you see a CSP error
console message about the API origin being blocked, the build-time env var was wrong.

---

## 8. GitHub Actions: deploy on every push to `frontend/**`

The workflow lives at
[`.github/workflows/deploy-frontend.yml`](../../.github/workflows/deploy-frontend.yml) — at the
repo root (GitHub Actions doesn't scan subfolders — see
[build-and-deploy.md](./build-and-deploy.md#how-two-workflows-share-one-repo) for why this matters
in a repo that also has a backend deploy workflow). It repeats exactly the steps you just ran by
hand in step 7: `npm ci` → `npm run build` (with the `VITE_*` vars from secrets) → `aws s3 sync` →
`aws cloudfront create-invalidation`.

### One-time setup: repo secrets

**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | From the IAM user created in step 6 |
| `AWS_REGION` | The region you created the S3 bucket in (step 1) — **not** necessarily `us-east-1`; that requirement is only for the ACM certificate |
| `S3_BUCKET_NAME` | `neodrive-frontend` (or whatever you named it) |
| `CLOUDFRONT_DISTRIBUTION_ID` | From the distribution's detail page |
| `VITE_API_BASE_URL` | `https://api.storage.anupamsingh.xyz/` (trailing slash) |
| `VITE_API_ORIGIN` | `https://api.storage.anupamsingh.xyz` (no trailing slash — CSP needs a bare origin) |
| `VITE_GOOGLE_CLIENT_ID` | Same value as the backend's `GOOGLE_CLIENT_ID` |
| `VITE_RAZORPAY_KEY_ID` | Same value as the backend's `RAZORPAY_KEY_ID` — **note**: as of this writing, the Subscriptions page doesn't actually read this var yet (it's hardcoded to a test key in `pages/app/subscriptions/index.jsx`) — see [environment-variables.md](./environment-variables.md#vars-that-look-wired-but-arent). Setting the secret here doesn't fix that; the source needs the one-line fix too. |

Once those exist, every push to `main` that touches `frontend/**` redeploys automatically. Watch
it under the repo's **Actions** tab.

Also update the **backend's** `CLIENT_URL_1`/`CLIENT_URL_2` (in its `.env` on the EC2 box — see
[../../backend/docs/ec2-deployment.md](../../backend/docs/ec2-deployment.md#5-configure-the-environment))
to `https://storage.anupamsingh.xyz`, or the backend's CORS allow-list will reject requests from
your new production frontend origin.

### If a deploy fails

Check the Actions tab logs first — `npm run build` failures show up there directly. For an
upload/invalidation failure specifically:
```bash
aws s3 ls s3://neodrive-frontend/            # did the files actually land?
aws cloudfront get-distribution --id <DISTRIBUTION_ID> --query 'Distribution.Status'
```

## Redeploying manually (without pushing)

Either re-run the steps in section 7 locally, or trigger the workflow by hand: **Actions → Deploy
NeoDrive Frontend (S3 + CloudFront) → Run workflow**.

## Updating CloudFront/S3 settings later

Changes made in the AWS console (custom error responses, cache behaviors, the ACM cert, etc.)
aren't tracked by this repo or touched by the GitHub Actions workflow — it only ever uploads
`dist/` and invalidates the cache. If you change something in CloudFront, it takes effect
immediately; there's no redeploy step needed for infrastructure changes, only for code changes.
