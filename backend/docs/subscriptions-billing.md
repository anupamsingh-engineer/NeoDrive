# Subscriptions & Billing (Razorpay)

Code: `src/routes/subscription.routes.js`, `src/routes/webhook.routes.js`,
`src/controllers/subscription.controller.js`, `src/controllers/webhook.controller.js`,
`src/services/subscription.service.js`, `src/repositories/subscription.repository.js`,
`src/repositories/webhookLog.repository.js`, `src/models/subscription.model.js`,
`src/models/webhookLog.model.js`, `src/config/constants.js` (`SUBSCRIPTION_PLANS`,
`PLAN_STORAGE_QUOTA_BYTES`).

`/subscriptions/*` requires auth + CSRF. `/webhooks/razorpay` is **public** (called by Razorpay's
servers, not the frontend) and authenticates via HMAC signature instead.

## Plan catalog

Plans are a static, in-memory list in `src/config/constants.js` — not a database collection. Each
`planId` must exactly match a Plan already created in the Razorpay dashboard (billing
interval/amount live there; this app only stores the id + display metadata + the storage quota it
grants).

```js
[
  { planId: "plan_TEPIgVM0I0kq8o", name: "2 TB",  amount: 999,  currency: "INR", billingCycle: "Every Month",       storageQuotaBytes: 2  * 1024**4, popular: false },
  { planId: "plan_TEPK72pd3uwy74", name: "5 TB",  amount: 3999, currency: "INR", billingCycle: "Once in 3 Months",  storageQuotaBytes: 5  * 1024**4, popular: true  },
  { planId: "plan_TEPL1YABpKuviH", name: "10 TB", amount: 4999, currency: "INR", billingCycle: "Every Year",        storageQuotaBytes: 10 * 1024**4, popular: false },
]
```

## `GET /subscriptions/plans` — requires auth

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "planId": "plan_TEPIgVM0I0kq8o",
      "name": "2 TB",
      "description": "For personal use and small teams",
      "amount": 999,
      "currency": "INR",
      "billingCycle": "Every Month",
      "storageQuotaBytes": 2199023255552,
      "features": ["2 TB storage", "Unlimited uploads", "Email support"],
      "popular": false
    }
  ]
}
```

## `POST /subscriptions` — requires auth + CSRF

**Request**
```json
{ "planId": "plan_TEPIgVM0I0kq8o" }
```

**Behavior**: creates a Razorpay subscription (`total_count: 100` billing cycles,
`notes: { userId }` — this note is what later lets webhook events, including refunds, be traced
back to a user) and a local `Subscription` document (`status: "created"`).

**This endpoint does not grant any storage quota.** It only starts the checkout — the frontend is
expected to complete Razorpay's hosted checkout using the returned `subscriptionId`. Quota is
only ever granted by the webhook handler below, once payment actually succeeds.

**Response `201`**
```json
{ "success": true, "data": { "subscriptionId": "sub_R1a2B3c4D5e6F7" } }
```

**Errors**: `400` missing `planId`.

---

## `POST /webhooks/razorpay` — public, signature-verified

Mounted in `app.js` **ahead of** the global `express.json()` body parser specifically so it can
capture the raw request bytes (`req.rawBody`) — Razorpay signs the exact byte sequence it sent,
and a re-serialized `JSON.stringify(req.body)` is not guaranteed to reproduce that byte-for-byte.

**Auth**: the `x-razorpay-signature` header is verified (`Razorpay.validateWebhookSignature`)
against `req.rawBody` using `RAZORPAY_WEBHOOK_SECRET`. Missing or invalid signature → `403`,
nothing is processed.

**Body** (shape varies by event — Razorpay's standard webhook envelope):
```json
{
  "event": "subscription.activated",
  "payload": {
    "subscription": { "entity": { "id": "sub_...", "status": "active", "plan_id": "plan_...", "notes": { "userId": "665f0a..." } } }
  }
}
```

### Event routing (`handleWebhookEvent` in `subscription.service.js`)

| Event prefix/name | Handler | Effect |
|---|---|---|
| `subscription.*` | `handleSubscriptionEvent` | Updates the local `Subscription.status` (mapped — see below). `subscription.activated` / `subscription.charged` additionally **grant** the plan's `storageQuotaBytes` onto `user.maxStorageInBytes` and bust that user's profile cache. `subscription.cancelled` / `subscription.completed` / `subscription.halted` **revoke** it — reset `maxStorageInBytes` back to `DEFAULT_MAX_STORAGE_BYTES`. |
| `refund.created`, `refund.processed` | `handleRefundEvent` | Resolves the user via `payload.payment.entity.notes.userId` (Razorpay copies a subscription's `notes` onto every payment it auto-charges, so this survives onto the refund payload) and downgrades to the free tier, same as a cancellation. |
| `payment.*` | `handlePaymentEvent` | Logged only, no side effect — a successful charge is already covered by the paired `subscription.charged` event; a failure only matters once Razorpay gives up retrying, which shows up as `subscription.halted`. |
| anything else | — | Ignored. |

**Razorpay status → local `Subscription.status` mapping** (Razorpay's vocabulary doesn't line up
1:1 with the local enum `created|active|pending|past_due|paused|canceled|in_grace`):

| Razorpay `subscription.entity.status` | Local `status` |
|---|---|
| `created`, `authenticated` | `created` |
| `active` | `active` |
| `pending` | `past_due` |
| `halted` | `paused` |
| `cancelled`, `completed`, `expired` | `canceled` |

A webhook for a subscription this server has never seen (no matching `razorpaySubscriptionId`)
is logged and ignored, not an error — Razorpay retries failed deliveries, and treating "unknown
subscription" as a hard failure would just cause endless pointless retries.

**Auditing**: every webhook — processed, ignored, or errored — is persisted to a `WebhookLog`
document (full raw payload, resolved `userId`/`razorpaySubscriptionId`/`razorpayPaymentId` where
known, and the error message if one occurred) and counted in the
`razorpay_webhook_events_total{event,status}` Prometheus metric. Logging failures are swallowed
(fail-open) — a logging bug must never turn an already-processed webhook into a `500`, which
would make Razorpay retry an event whose real side effects already landed.

**Response `200`** (always, once signature verification passes — Razorpay expects `2xx` to stop
retrying)
```json
{ "success": true }
```
