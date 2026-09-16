---
name: OC Integration Bridge
description: Architecture and file locations for the Quest↔OC server-to-server payment integration
---

# Quest ↔ Original Concepts Integration Bridge

## Architecture

Quest never holds Stripe/PayPal secrets. All payment execution lives in OC.

```
Quest browser
  → Quest backend (server/routes.ts)
    → OC /api/integrations/quest/payments  (creates PaymentIntent or Checkout Session)
    ← { clientSecret, ocPaymentId }
  → Stripe.js confirmCardPayment(clientSecret)  [OC's Stripe account]
  → Quest backend (final purchase endpoint)
    → OC /api/integrations/quest/payments/:id  (verify status)
    ← { status: "paid" }
  → record purchase in Quest Firestore
```

## Files

**OC repository (Delo92/OraginConcepts):**
- `server/routes/quest-integration.ts` — 5 integration endpoints (committed to main)
- `server/routes.ts` — imports and calls `registerQuestIntegration(app)` (committed to main)

**Quest workspace:**
- `server/services/ocAdapter.ts` — HTTP client for OC integration API
- `server/routes.ts` — imports `isOCAdapterConfigured`, `createOCPayment`, `getOCPayment`
- `client/src/lib/buyer-payment.ts` — `confirmStripeCardPayment` now returns `{ paymentIntentId, ocPaymentId }`
- `client/src/pages/host.tsx` — destructures new return, passes `ocPaymentId` to `submitData`
- `client/src/pages/join.tsx` — same

## OC Integration Endpoints

All require `Authorization: Bearer <QUEST_OC_INTEGRATION_TOKEN>`

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/integrations/quest/payments | Create PaymentIntent (→ clientSecret) or Checkout Session (→ checkoutUrl) |
| GET | /api/integrations/quest/payments/:id | Verify status; syncs live from Stripe when pending |
| POST | /api/integrations/quest/payouts | Release approved OC payroll batch via Stripe Connect |
| GET | /api/integrations/quest/payouts/:id | Get payout status |
| POST | /api/integrations/quest/payees/:id/onboarding | Stripe Connect Express onboarding link |

## OC Firestore collections created

- `quest_integration_payments` — payment records with idempotency keys
- `quest_integration_payouts` — payout release records

## Secrets / Env Vars

| Location | Key | Purpose |
|----------|-----|---------|
| Quest (Replit) | QUEST_OC_API_TOKEN | Bearer token sent by Quest to OC |
| Quest (Replit) | OC_API_BASE_URL | OC server origin (set to https://oraginalconcepts.com) |
| OC server | QUEST_OC_INTEGRATION_TOKEN | Same token value, validated by OC |

**Why:** OC must set `QUEST_OC_INTEGRATION_TOKEN` to the same value as Quest's `QUEST_OC_API_TOKEN` before the integration goes live.

## Routing logic in Quest

`secureAuthorizeCharge` checks `details.ocPaymentId` first:
- If present and OC is configured → verifies via `getOCPayment()` (no Quest Stripe key needed)
- Otherwise falls through to existing Authorize.Net / Stripe / PayPal paths

The stripe-intent endpoints (`/api/payment-provider/stripe-intent` and `/api/guest/checkout/stripe-intent`) call OC when `isOCAdapterConfigured()` returns true, returning `{ clientSecret, ocPaymentId }`.

## What still needs to be done (OC side)

OC must set the environment variable `QUEST_OC_INTEGRATION_TOKEN` to the same value as Quest's `QUEST_OC_API_TOKEN`. Without that, OC returns 503 on every integration call.
