---
name: OC Integration Bridge
description: Architecture and confirmed endpoint map for the Quest↔OC server-to-server payment integration
---

# Quest ↔ Original Concepts Integration Bridge

## Architecture

Quest never holds Stripe/PayPal secrets. All payment execution lives in OC.

```
Quest browser
  → Quest backend (server/routes.ts)
    → OC /api/integrations/quest/payments  (creates PaymentIntent or PayPal order)
    ← { clientSecret | approvalUrl, ocPaymentId }
  → Stripe.js confirmCardPayment(clientSecret)  [OC's Stripe account]
    OR redirect buyer to approvalUrl [OC's PayPal account]
  → Quest backend (final purchase endpoint)
    → OC /api/integrations/quest/payments/:id  (verify status)
    ← { status: "paid" }
  → record purchase in Quest Firestore
```

## Confirmed OC API (as of launch sprint)

OC token env var name: `QUEST_OC_API_TOKEN` (same key name used in both OC and Quest environments)
OC base URL: `https://oraginalconcepts.com`

### Integration endpoints (`/api/integrations/quest/*`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /payments | Create Stripe PaymentIntent (→ clientSecret) or PayPal order (→ approvalUrl) |
| GET | /payments/:id | Verify status; syncs live from Stripe/PayPal when pending |
| POST | /payments/:id/capture | Capture a PayPal order after buyer approval |
| POST | /payments/:id/refund | Issue refund via Stripe or PayPal |
| GET | /payouts/:batchId | Read payroll batch + ledger status |

### Portal batch endpoints (`/api/portal/quest/*`) — also accept integration token
| Method | Path | Purpose |
|--------|------|---------|
| POST | /batches/:id/approve | Approve a payroll batch |
| POST | /batches/:id/release | Release (Stripe Connect transfers) an approved batch |

## Quest files

- `server/services/ocAdapter.ts` — all OC calls; exports `isOCAdapterConfigured`, `createOCPayment`, `getOCPayment`, `captureOCPayPalPayment`, `refundOCPayment`, `getOCPayoutBatch`, `approveOCBatch`, `releaseOCBatch`
- `server/routes.ts` — stripe-intent and paypal-order endpoints call OC when configured; `secureAuthorizeCharge` verifies via OC when `ocPaymentId` present
- New Quest endpoints: `POST /api/oc/paypal-capture`, `POST /api/oc/payments/:id/refund`
- `client/src/lib/buyer-payment.ts` — `confirmStripeCardPayment` returns `{ paymentIntentId, ocPaymentId }`
- `client/src/pages/host.tsx`, `join.tsx` — pass `ocPaymentId` through `submitData`

## Quest env vars
| Key | Value |
|-----|-------|
| QUEST_OC_API_TOKEN | shared bearer token (set in Replit secrets) |
| OC_API_BASE_URL | https://oraginalconcepts.com (set as shared env var) |

## Routing logic
- `isOCAdapterConfigured()` checks `QUEST_OC_API_TOKEN` is truthy
- When true, stripe-intent routes call OC instead of Quest's local Stripe; paypal-order routes call OC instead of Quest's local PayPal
- `secureAuthorizeCharge` checks `ocPaymentId` first → verifies via `getOCPayment()` (no Quest Stripe key needed)
- Authorize.Net path unchanged as baseline fallback

## PayPal capture flow
1. Frontend calls `/api/payment-provider/paypal-order` or `/api/guest/checkout/paypal-order`
2. Server calls OC → gets `{ approvalUrl, ocPaymentId }`
3. Frontend stores `ocPaymentId` in sessionStorage, redirects buyer to `approvalUrl`
4. After buyer approves, frontend calls `POST /api/oc/paypal-capture` with `{ ocPaymentId }`
5. Quest server calls OC `POST /payments/:id/capture`
6. Final checkout request includes `ocPaymentId`; server verifies via OC `GET /payments/:id`

**Why:** OC owns PayPal credentials; capture must happen server-to-server through OC.
