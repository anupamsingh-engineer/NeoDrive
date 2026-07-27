# Caching (Redis, cache-aside)

Code: `src/services/cache.service.js`.

## The core pattern: `getOrSet`, fail-open

```js
await cacheService.getOrSet(cacheName, key, ttlSeconds, fetcher);
```

1. Try a Redis `GET key`. Hit → `cacheHitTotal.inc({ cache: cacheName })`, return
   `JSON.parse(cached)`.
2. Miss (or Redis errored) → `cacheMissTotal.inc(...)`, call `fetcher()` (the real DB read),
   `SET key <value> EX ttlSeconds`, return the value.

**Fail-open on every Redis error, read or write**: any exception talking to Redis is caught,
logged as a warning, and treated as a cache miss. A Redis outage degrades the app to "always hit
the database" — slower, but never a `500`. This is deliberate throughout `cache.service.js`,
including `invalidate`, `get`, `set`, and `setNX` — none of them can turn a Redis problem into a
request failure.

## The two caches in use

| Cache name | Key format | TTL | Populated in | Busted by |
|---|---|---|---|---|
| `user_profile` | `user:profile:<userId>` | 300s (5 min) | `userService.getCurrentUser` (`GET /users/me`) | `userService.invalidateProfileCache` — called on user delete and on any subscription-webhook quota change |
| `dir_listing` | `dir:listing:<userId>:<dirId>` | 45s | `directoryService.getDirectory` (`GET /directory/:id?`) | `invalidateDirectoryListings(userId, ...dirIds)` — called on every directory/file create, rename, delete, and by the nightly size-reconcile job |

See [users.md](./users.md), [directories.md](./directories.md), and
[subscriptions-billing.md](./subscriptions-billing.md) for exactly which endpoints read/write
each.

**Directory listing invalidation is call-site driven, not TTL-only.** Every mutation that changes
what a directory listing would show — a new file, a renamed folder, a delete that changes an
ancestor's `size` — explicitly calls `invalidateDirectoryListings` for every directory id it
touched (the target itself, plus every ancestor whose `size` changed via
`incrementSizeUpChain`, since a listing embeds its own `size`). The 45s TTL is a safety net for
drift, not the primary invalidation mechanism — your own writes are reflected immediately.

**`user_profile` caches everything except `usedStorageInBytes`.** That field is read fresh from
the directory record on every `/users/me` call, specifically so storage-usage numbers are never
stale even while the rest of the profile can lag up to 5 minutes — see
[users.md](./users.md#get-usersme--requires-auth).

## Other Redis usage outside `cache.service.js`

Not cache-aside, but the same Redis instance:

| Use | Where | Key format |
|---|---|---|
| OTP resend cooldown (`SET NX ... EX`) | `otp.service.js` | `otp:cooldown:<email>` |
| Access-token blacklist (logout) | `token.service.js` | `auth:blacklist:<sha256(token)>` |
| Rate-limit counters (`rate-limit-redis`) | `rateLimit.middleware.js` | `rl:<limiter>:...` |
| BullMQ job store/broker | `queues/connection.js` | (managed internally by BullMQ) |

See [security.md](./security.md) for the blacklist/cooldown/rate-limit details and
[background-jobs.md](./background-jobs.md) for BullMQ.
