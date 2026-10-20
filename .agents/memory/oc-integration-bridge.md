---
name: OC Integration Bridge
description: Architecture and confirmed endpoint map for the Quest↔OC server-to-server payment integration
---

# Quest ↔ Original Concepts Integration Bridge

## Owner decision: Quest-owned Stripe

The Quest owners want both incoming Stripe payments and the funding of outgoing payouts to use their own Stripe account rather than Original Concepts' Stripe account. For NEW buyer payments, Quest-owned Stripe is the ONLY allowed provider: no PayPal or Authorize.Net options or automatic fallback. Preserve existing sign-in, unrelated OC social synchronization, historical payment records and refund access. Recipient payout migration is separate from checkout activation and must not send money merely to verify configuration.

**Why:** The owner stated that Quest will no longer use Original Concepts for Stripe, supplied credentials for Quest's own account, and clarified that their account must be “where payments go and payouts come from.” They further specified: “we need no paypal or authorize options only the quest stripe.”

**How to apply:** Scope both direct checkout and approved recipient disbursements from Quest-owned funds. Check actual routing and credential precedence rather than assuming a key replacement changes the merchant. Distinguish the existing embedded PaymentIntent flow from Stripe-hosted Checkout. Historical payments and refunds remain tied to the account that originally processed them. Distinguish settlement into Quest's own bank account from paying third-party hosts or talent: recipient payments require an eligible third-party payout product, not treating recipient bank accounts as Quest-owned external accounts.

Do not flip a shared legacy provider setting before deployment when older code interprets Stripe as OC-owned. Keep the Stripe-only decision in the new code so the code and processor routing take effect together.

**Why:** Older builds can read the same Firestore settings while still creating OC PaymentIntents; switching the shared field early can pair Quest's publishable key with an OC payment.

**How to apply:** Preserve the old setting during rollout and verify the running build’s actual public configuration and intent routing. Missing credentials must fail closed, not enable another processor.

Do not present a publishable key as a universal Stripe requirement. Server-created, Stripe-hosted Checkout can redirect to the returned session URL using only server-side Stripe credentials; webhook signatures use a separate signing secret. Embedded Stripe.js payment confirmation does require a publishable key.

**Why:** The owner reported that OC takes Stripe payments with a secret key and webhook signing secret without a separate publishable-key setting. Stripe's hosted Checkout documentation confirms that server-only session creation and redirect are supported. A missing publishable key in Quest's current configuration does not establish that OC or Quest has never processed Stripe payments historically.

**How to apply:** Determine the actual checkout flow before stating key requirements. For the requested owner-account cutover, explain hosted Checkout as an alternative to requiring another key for the existing embedded form. Do not claim to have inspected OC's implementation when only Quest's bridge has been read.

## Original bridge architecture (reference; inspect current code before changes)

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

## Per-user OC account and brand-kit access

Each Quest user’s OC account connection is separate from the optional OC referral and the existing Quest-to-OC server integration. The user explicitly consents to Quest using the selected kit’s identity/media and publishing to that kit’s connected social accounts. Do not reuse the shared `QUEST_OC_API_TOKEN` or OC’s normal portal-session JWT as the linked user’s credential. The portal JWT represents broader portal access. Use a distinct, user-consented authorization scoped to the selected kit and its authorized social accounts; keep its credentials encrypted on Quest’s server and associate the grant with the authenticated Quest user. OC retains the social-platform credentials and performs publishing. Disconnecting one Quest account must not affect the shared integration or other users.

**Why:** The owners want each individual Quest user to connect their own OC account, select a brand kit, and authorize Quest to post to its connected social accounts. A service-wide integration token cannot represent that user’s identity or consent, and reusing a normal portal session would grant more access than this feature needs.

**How to apply:** Use a user-specific grant that covers reading brand-kit identity/media and publishing only to the selected kit’s authorized social accounts. Keep OC access/refresh tokens off the browser, use OC as the publishing broker, and make the consent, selected kit, connected targets, and disconnect status visible in Quest.

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
