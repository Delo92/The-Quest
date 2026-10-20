# Quest → Original Concepts event-based social automation

## Scope and rollout boundary

Quest hosts and approved contestants may receive **social-media automation from
OC's Gold package ($105/month)** for their first eligible Quest event. This is a
limited promotional feature, **not a free permanent Gold subscription**.

Quest now supplies event-bound signup links and an authenticated, live eligibility
API. OC must implement the signup binding, entitlement storage, scheduler checks,
and revocation described below. **Passing the URL alone does not activate or
revoke an OC entitlement. Do not enable the offer until OC enforces this contract.**

This contract is separate from:

- Per-user OAuth consent, kit access, and explicit post submission in
  [oc-account-linking-contract.md](oc-account-linking-contract.md).
- Paid OC subscriptions and payment processing.
- Existing profile scanning and the required Quest marketing acknowledgment.

## Confirmed cutoff policy

End the promotional automation benefit when **any** of these happens:

1. The specific event completes, reaches its end date, is cancelled, or is deleted.
2. The contestant withdraws, is removed, or no longer has an approved entry.
3. The contestant is eliminated in any recorded stage.
4. The host no longer owns the event, the account is deleted, or its role is no
   longer eligible.

An event must be active or voting and have a confirmed, valid future end date.
Draft events, pending/rejected entries, missing end dates, and TBD end dates do
not grant an open-ended benefit. Date-only end dates include the entire UTC day,
matching Quest's date-only deadline convention; timestamp end dates use their
exact instant. An end date changed to unknown/TBD after activation ends eligibility.

Quest binds a contestant's original entry/profile IDs; deleting and reapplying
does not renew the benefit. Once an activated benefit is observed as ended, it
stays revoked even if the event/entry is later restored. Automatic renewals,
switching to another event, and restarting for the next competition are not allowed.

## 1. User chooses a source event in Quest

`GET /api/oc/referral/events` requires the Quest user's Firebase bearer token.
It derives the role from the saved account and returns only associated host
events or contestant entries, with an eligibility reason for each.

The dashboard selects the sole eligible event automatically. When multiple
events are eligible, the user must select one. Unrelated video/profile selections
are not used as the referral source.

On **Continue to OC**, Quest calls:

```http
POST /api/oc/referral/start
Authorization: Bearer <QUEST_USER_FIREBASE_TOKEN>
Content-Type: application/json

{"competitionId": 123}
```

Quest revalidates the association, loads saved profile fields, and returns
`{ "referralUrl": "...", "event": {...} }`. The browser then navigates to that URL.
The user sees a disclosure before choosing to share profile and event details.

The existing destination is preserved:
`https://oraginalconcepts.com/s/TheQuest/referral`.

### Referral query parameters

| Field | Purpose |
| --- | --- |
| `source` | `the-quest` |
| `promoCode` | `THE QUEST` |
| `role` | `host` or `artist` |
| `email`, `displayName`, `stageName`, `brandName`, `artistName` | Optional saved identity prefill; artistName is artist-only |
| `socialLinks` | Optional JSON of sanitized public URLs |
| `questEvent` | JSON containing competitionId, title, category, status, startDate, endDate, contestantId |
| `questReferralId` | Opaque 256-bit server reference, 43 base64url characters |

**All query parameters are editable and untrusted.** The event JSON is prefill,
not entitlement proof. OC must preserve `questReferralId` through signup and
server verification. Do not allow a promo code or URL event ID to bypass the
verification step.

Do not send referral URLs/references to analytics or third parties. OC should
store the reference server-side, remove it from the browser address bar after
capture, and use a restrictive Referrer-Policy. Quest stores only its hash and
does not log OC response bodies.

## 2. OC verifies the account and activates the one-time event binding

After OC has a signed-in client with a **verified email**, call from the OC
server to the actual published Quest origin:

```http
POST <QUEST_PRODUCTION_ORIGIN>/api/integrations/oc/referral/eligibility
Authorization: Bearer <EXISTING_QUEST_OC_SHARED_SERVICE_TOKEN>
Content-Type: application/json

{
  "referralId": "<questReferralId>",
  "ocAccountId": "<stable-internal-OC-client-ID>",
  "verifiedEmail": "<email-from-OC-authenticated-account-record>"
}
```

Use the already shared `QUEST_OC_API_TOKEN` service credential. Never expose it
to the browser, use it as a user's OAuth token, or accept ocAccountId/verifiedEmail
from browser-supplied values without loading OC's authenticated account record.
The initial verified OC email must match the saved Quest account email
(case-insensitive). If it does not, do not grant the benefit; resolve identity
ownership rather than silently matching names.

The first eligible verification atomically binds the Quest user, event,
original entry/profile (if applicable), and OC account ID. Generating a signup
link does not consume the offer. Unclaimed links expire after 24 hours; users can
return to Quest for a fresh link. A claimed reference remains usable for live
checks after that handoff window.

Quest rejects different-event/account claims. Repeated verification for the same
binding is safe and must not create additional subscriptions or grants. OC must
also check its existing referral/entitlement records to prevent reissuing any
historical one-time benefits that predate this contract.

Example successful response (all event and identity fields are server-derived):

```json
{
  "eligible": true,
  "reason": "eligible",
  "referralId": "<same-reference>",
  "role": "artist",
  "questUserId": "<stable-Quest-user-ID>",
  "ocAccountId": "<stable-OC-client-ID>",
  "offer": {
    "code": "QUEST_EVENT_AUTOMATION",
    "plan": "gold",
    "feature": "social_media_automation",
    "planMonthlyPriceCents": 10500,
    "currency": "USD"
  },
  "checkedAt": "2026-10-20T12:00:00.000Z",
  "expiresAt": "2026-12-21T23:59:59.999Z",
  "revokedAt": null,
  "event": {
    "competitionId": 123,
    "title": "Selected Quest event",
    "category": "Music",
    "status": "active",
    "startDate": "2026-10-01",
    "endDate": "2026-12-21",
    "contestantId": 456
  },
  "profile": {
    "email": "artist@example.com",
    "displayName": "Artist",
    "stageName": null
  }
}
```

OC should persist source, offer code, Quest UID, OC client ID, referral reference,
competition ID/title, original contestant ID, role, initial event dates,
activation/check timestamps, latest expiry, and revocation state/reason. Retain
the initial attribution for audit history even when the event metadata changes.

## 3. Recheck and revoke on OC

- Call the same endpoint **immediately before every automated publish/run** and
  before enabling the promotional feature in a client session. Do not use cached
  eligibility to authorize a later run.
- Recheck active promotional grants at least every five minutes so idle clients
  also lose the entitlement promptly. This is a pull contract, not a pushed
  revocation webhook; cancellation/removal detection latency is the OC polling
  interval. Schedule local cutoff at `expiresAt` as an additional safety measure.
- A response with `eligible: false` must disable the promotional feature,
  cancel future promotion-funded jobs, and persist `reason`/`revokedAt`.
- **Any timeout, non-2xx response, invalid response, missing referral, or
  unavailable Quest service must fail closed:** pause promotion-funded automation
  until a new successful live check. Never replace failures with `eligible: true`.
- Re-read and persist changed dates from successful checks. The signup URL's
  dates are never authoritative.
- Revoke **only** the promotional `social_media_automation` entitlement. Do not
  cancel a paid Gold subscription, disconnect social accounts, revoke user OAuth,
  delete brand kits, or withdraw other purchased features.
- Previously completed posts remain published. Do not silently start billing
  after expiry; any paid upgrade needs separate OC purchase consent.

Known negative reasons include `event_ended`, `event_cancelled`, `event_removed`,
`entry_removed`, `entry_not_approved`, `entry_replaced`, `contestant_eliminated`,
`host_removed`, `account_removed`, `role_changed`, `event_not_active`,
`event_end_unconfirmed`, `handoff_expired`, and `offer_already_assigned`.
Errors include 401 (service auth), 403 (identity mismatch), 404 (unknown reference),
409 (already assigned/revoked), and 503 (cannot verify). All responses are no-store.

## Storage and rollout requirements

Quest uses Admin SDK-only `ocEventReferrals` and `ocEventBenefitClaims` records.
There is no deployed Firestore rules source in this repository. **Before rollout,
verify that deployed Firebase rules deny all direct client reads/writes to both
collections**, as well as the OAuth collections covered in the account contract.
Do not add a broad Firestore rule that exposes these records.

Existing OC referrals without a verified event binding cannot safely inherit this
benefit. OC must reconcile their original event from verified records or require
a fresh Quest handoff; do not guess from the client's latest event or video.

Quest-side tests cover association, event/entry changes, one-time account binding,
cutoff conditions, expiry, sticky revocation, and HTTP auth/input handling.
Live OC signup, its scheduler, deployed rules, and end-to-end revocation still
require OC-side implementation and validation.
