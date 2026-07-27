# Error Handling

Code: `src/errors/ApiError.js`, `src/errors/asyncHandler.js`,
`src/middlewares/errorHandler.middleware.js`, `src/middlewares/notFound.middleware.js`.

## The pattern

Every controller and async middleware is wrapped in `asyncHandler`:

```js
export function asyncHandler(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
```

This means any `throw` (or rejected promise) anywhere inside a controller or service call chain
propagates straight to Express's error pipeline — there is no manual `try/catch` in controllers.
Services signal "the client did something wrong" or "this can't be done" by throwing `ApiError`;
everything else (a real bug, an unhandled driver error) falls through to the generic 500 branch
below.

## `ApiError`

```js
class ApiError extends Error {
  constructor(statusCode, message, details) { ... }
  static badRequest(message, details)   // 400
  static unauthorized(message)          // 401
  static forbidden(message)             // 403
  static notFound(message)              // 404
  static conflict(message)              // 409
  static insufficientStorage(message)   // 507
  static internal(message)              // 500
}
```

Services throw these directly, e.g. `throw ApiError.notFound("File not found!")`. `details` is
optional and surfaces in the response only when present — used for zod validation field errors.

## The error envelope

Every error response — from `ApiError`, from a thrown Mongoose/JWT error, or from anything
unexpected — is normalized by the single `errorHandlerMiddleware` (mounted last in `app.js`) into
the same shape:

```json
{ "success": false, "message": "Human-readable message", "details": { "...": "optional" } }
```

### Status-code catalog (what actually produces each one)

| Status | Meaning here | Typical trigger |
|---|---|---|
| `400` | Bad request | zod validation failure (`details.fieldErrors`), invalid ObjectId shape, blocked file extension, Mongoose `ValidationError`, expired/invalid password-reset token |
| `401` | Not authenticated / session invalid | missing/invalid/expired access token, blacklisted token, revoked session (`tokensValidAfter`), invalid credentials on login, expired/invalid refresh token, reused (stolen) refresh token |
| `403` | Not authorized | RBAC failure (`authorizeRoles`), invalid/missing CSRF token, locked account, deleting your own admin account, deleted-account Google login |
| `404` | Not found | directory/file not found *or not owned by the caller* (deliberately indistinguishable from "doesn't exist" — no existence leak), unmatched route (`notFoundMiddleware`) |
| `409` | Conflict | duplicate email on register (Mongo unique-index violation, `err.code === 11000`), refresh-token rotation race (benign — client should retry) |
| `429` | Too many requests | any rate limiter tripped (see [security.md](./security.md)) |
| `500` | Unexpected server error | anything not explicitly handled — message is replaced with a generic `"Something went wrong"` in production (the real message is logged, not returned, so internals never leak to a client) |
| `507` | Insufficient storage | atomic quota reservation failed on upload initiate (see [files.md](./files.md)) |

### Special-cased non-`ApiError` errors (still normalized to the same envelope)

| Source | Detected by | Response |
|---|---|---|
| Multer (not currently used for uploads, but handled defensively) | `err.name === "MulterError"` | `400 "Upload error: <message>"` |
| Mongo duplicate key | `err.code === 11000` | `409 "<field> already exists"` |
| Mongoose schema validation | `err.name === "ValidationError"` | `400 "Invalid input"` with `details: err.errors` |
| JWT errors (bad signature, expired, wrong purpose) | `err.name === "JsonWebTokenError" \| "TokenExpiredError"` | `401 "Invalid or expired token"` |

Any `ApiError` with `statusCode >= 500` is also logged at `error` level server-side (client-caused
4xx errors are not logged as errors — they're expected, routine responses).

## Unmatched routes

`notFoundMiddleware` (mounted after all routes, before the error handler) catches anything that
didn't match any route:
```json
{ "success": false, "message": "Route not found: GET /nope" }
```

## Process-level safety nets (`server.js` / `src/worker.js`)

- `unhandledRejection` → logged, process kept alive (a bug, but not necessarily fatal to the rest
  of the process's in-flight work).
- `uncaughtException` → logged, process **exits** (`process.exit(1)`) — an uncaught exception
  means the process is in an unknown state; better to let the orchestrator restart it than keep
  serving from it.
- `SIGTERM`/`SIGINT` → graceful shutdown: stop accepting new connections, close BullMQ
  queues/workers, disconnect Mongo/Redis, force-exit after a 10s timeout if graceful shutdown
  hangs.
