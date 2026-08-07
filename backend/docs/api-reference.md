# API Reference (flat index)

Every route in the app, in one table. This is the lookup version — see the linked doc for request/
response bodies, exact validation rules, and behavior notes.

Base URL: no prefix, e.g. `http://localhost:4000/auth/login`. Response envelope and error format:
see [README.md](./README.md#conventions-used-across-every-endpoint).

**Auth** column: `–` public · `Auth` requires a valid access token (cookie or Bearer) ·
`Auth+CSRF` also requires the `x-csrf-token` header for non-GET requests · role names mean `Auth`
plus that role.

## Health & metrics

| Method | Path | Auth | Rate limit | Doc |
|---|---|---|---|---|
| GET | `/healthz` | – | global | [observability.md](./observability.md) |
| GET | `/readyz` | – | global | [observability.md](./observability.md) |
| GET | `/metrics` | `x-metrics-token` header or `Authorization: Bearer` if `METRICS_TOKEN` set | global | [observability.md](./observability.md) |

## Auth (`/auth`)

| Method | Path | Auth | Rate limit | Doc |
|---|---|---|---|---|
| POST | `/auth/send-otp` | – | authLimiter (10/15m) | [authentication.md](./authentication.md#post-authsend-otp) |
| POST | `/auth/verify-otp` | – | authLimiter | [authentication.md](./authentication.md#post-authverify-otp) |
| POST | `/auth/register` | – | authLimiter | [authentication.md](./authentication.md#post-authregister) |
| POST | `/auth/login` | – | authLimiter | [authentication.md](./authentication.md#post-authlogin) |
| POST | `/auth/google` | – | authLimiter | [authentication.md](./authentication.md#post-authgoogle) |
| POST | `/auth/refresh` | – (reads `refreshToken` cookie) | refreshLimiter (120/15m) | [authentication.md](./authentication.md#post-authrefresh) |
| POST | `/auth/forgot-password` | – | authLimiter | [authentication.md](./authentication.md#post-authforgot-password) |
| POST | `/auth/reset-password` | – | authLimiter | [authentication.md](./authentication.md#post-authreset-password) |
| POST | `/auth/logout` | Auth+CSRF | global | [authentication.md](./authentication.md#post-authlogout--requires-auth--csrf) |
| POST | `/auth/logout-all` | Auth+CSRF | global | [authentication.md](./authentication.md#post-authlogout-all--requires-auth--csrf) |

## Users (`/users`)

| Method | Path | Auth | Doc |
|---|---|---|---|
| GET | `/users/me` | Auth | [users.md](./users.md#get-usersme--requires-auth) |
| GET | `/users?page=&limit=` | Admin, Manager | [users.md](./users.md#get-users--requires-auth--role-admin-or-manager) |
| POST | `/users/:userId/logout` | Admin, Manager +CSRF | [users.md](./users.md#post-usersuseridlogout--requires-auth--csrf--role-admin-or-manager) |
| DELETE | `/users/:userId` | Admin +CSRF | [users.md](./users.md#delete-usersuserid--requires-auth--csrf--role-admin) |

## Directories (`/directory`)

All require Auth (+CSRF for non-GET).

| Method | Path | Rate limit | Doc |
|---|---|---|---|
| GET | `/directory/:id?` | global | [directories.md](./directories.md#get-directoryid) |
| POST | `/directory/:parentDirId?` (name via `dirname` header) | global | [directories.md](./directories.md#post-directoryparentdirid) |
| PATCH | `/directory/:id` | global | [directories.md](./directories.md#patch-directoryid) |
| DELETE | `/directory/:id` | global | [directories.md](./directories.md#delete-directoryid) |
| GET | `/directory/download` or `/directory/:id/download` | directoryDownloadLimiter (10/min/user) | [directories.md](./directories.md#get-directorydownload-and-get-directoryiddownload) |

## Files (`/file`)

All require Auth (+CSRF for non-GET).

| Method | Path | Rate limit | Doc |
|---|---|---|---|
| POST | `/file/upload/initiate` | uploadLimiter (60/min/user) | [files.md](./files.md#post-fileuploadinitiate) |
| POST | `/file/upload/complete` | global | [files.md](./files.md#post-fileuploadcomplete) |
| GET | `/file/:id?action=download` | global | [files.md](./files.md#get-fileidactiondownload) |
| PATCH | `/file/:id` | global | [files.md](./files.md#patch-fileid) |
| DELETE | `/file/:id` | global | [files.md](./files.md#delete-fileid) |

## Sharing (`/share`)

All require Auth (+CSRF for non-GET).

| Method | Path | Rate limit | Doc |
|---|---|---|---|
| POST | `/share` | shareCreateLimiter (20/min/user) | [sharing.md](./sharing.md#post-share--create-or-fetch-a-share-link) |
| GET | `/share` | global | [sharing.md](./sharing.md#get-share--list-my-active-share-links) |
| DELETE | `/share/:id` | global | [sharing.md](./sharing.md#delete-shareid--revoke) |

## Public share links (`/s`)

**No auth, no CSRF** — the one fully-public, unauthenticated data-fetching surface in this API.

| Method | Path | Rate limit | Doc |
|---|---|---|---|
| GET | `/s/:token` | shareResolveLimiter (300/15m/IP) | [sharing.md](./sharing.md#get-stoken--public-view-file-metadata-or-browse-a-shared-folder) |
| GET | `/s/:token/download` | shareDirectoryDownloadLimiter (5/min/IP) | [sharing.md](./sharing.md#get-stokendownload--public-download-a-whole-shared-folder-or-subfolder-as-a-zip) |
| GET | `/s/:token/file/:fileId?action=download` | shareResolveLimiter | [sharing.md](./sharing.md#get-stokenfilefileidactiondownload--public-download-a-file-within-a-share) |

## Subscriptions (`/subscriptions`)

All require Auth (+CSRF for non-GET).

| Method | Path | Doc |
|---|---|---|
| GET | `/subscriptions/plans` | [subscriptions-billing.md](./subscriptions-billing.md#get-subscriptionsplans--requires-auth) |
| POST | `/subscriptions` | [subscriptions-billing.md](./subscriptions-billing.md#post-subscriptions--requires-auth--csrf) |

## Webhooks (`/webhooks`)

Mounted separately in `app.js`, ahead of the JSON body parser — see
[subscriptions-billing.md](./subscriptions-billing.md).

| Method | Path | Auth | Doc |
|---|---|---|---|
| POST | `/webhooks/razorpay` | `x-razorpay-signature` HMAC (public, no session) | [subscriptions-billing.md](./subscriptions-billing.md#post-webhooksrazorpay--public-signature-verified) |
