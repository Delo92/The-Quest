# ChronicBrandsUSA Partner Promo Code Integration Guide

## Overview

ChronicBrandsUSA operates a shared loyalty/referral network across all of its partner sites.
A single universal promo code (format: `CBUSA-XXXXXX`) is issued to customers after they
complete a service on any network site. That code can be redeemed on **any other site in the
network** and will automatically return the correct reward for that site — configured by the
network owner.

The reward a customer receives depends on two things:
1. **Which site issued the code** (where the customer originally came from)
2. **Which site they are redeeming on** (where they are using the code now)

This allows the owner to define a full cross-site reward matrix — e.g., a ChronicDocs customer
redeeming on SacredWellness gets 10% off GLP-1, while a SacredWellness customer redeeming on
ChronicDocs gets a free month of Premier membership.

---

## Network Sites

| Site ID         | Site                          | Example reward when redeemed here |
|-----------------|-------------------------------|-----------------------------------|
| `chronicdocs`   | ChronicDocs.com               | Free month of Premier membership  |
| `sacredwellness`| SacredWellnessAssociation.com | 10% off GLP-1 for one month       |
| `esa`           | (ESA letter site)             | 10% off ESA letter                |
| `handicap`      | (Handicap parking site)       | Owner-configured discount         |
| `doctornotes`   | (Doctor notes site)           | Owner-configured discount         |

The owner can add new sites and configure every source → destination reward combination
from the ChronicDocs admin panel without any code changes.

---

## Code Format

```
CBUSA-XXXXXX
```

- Prefix is always `CBUSA-`
- Followed by 6 alphanumeric characters (uppercase, no ambiguous chars like 0/O or 1/I)
- Example: `CBUSA-R7K2NP`
- Codes expire **30 days** after issuance
- Each code is **single-use** — once redeemed it cannot be used again

---

## Authentication

All API calls require an API key in the request header:

```
x-promo-api-key: YOUR_API_KEY
```

Your API key is provided by ChronicDocs. Keep it secret — treat it like a password.
If you believe your key is compromised, contact ChronicDocs to have it rotated.

**Base URL:** `https://chronicdocs.com`

---

## Integration Flow

Your site should implement this two-step flow when a customer applies a promo code at checkout:

### Step 1 — Validate (before showing the discount)

Call validate to confirm the code is valid and receive the reward your site should apply.

**Request:**
```
POST /api/promo/validate
Content-Type: application/json
x-promo-api-key: YOUR_API_KEY

{
  "code": "CBUSA-R7K2NP",
  "redeemingSite": "sacredwellness"
}
```

`redeemingSite` must be your site's ID from the network table above. This tells ChronicDocs
which reward to look up for your site.

**Success Response (valid code):**
```json
{
  "valid": true,
  "code": "CBUSA-R7K2NP",
  "sourceSite": "chronicdocs",
  "patientEmail": "patient@example.com",
  "expiresAt": "2026-04-11T00:00:00.000Z",
  "daysRemaining": 28,
  "reward": {
    "rewardType": "percent_discount",
    "rewardValue": 10,
    "rewardDescription": "10% off your first month of GLP-1"
  }
}
```

**Invalid code responses:**
```json
{ "valid": false, "reason": "Code not found" }
{ "valid": false, "reason": "Code already redeemed", "usedAt": "..." }
{ "valid": false, "reason": "Code expired", "expiresAt": "..." }
```

**What to do with the response:**
- If `valid: false` — tell the customer the code is not valid and do not apply a discount
- If `valid: true` — use `reward.rewardDescription` as the display text at checkout
- Use `reward.rewardType` and `reward.rewardValue` to apply the correct discount in your system
- Do NOT mark the code as used yet — wait until the order is confirmed (Step 2)

### Step 2 — Redeem (after the order is confirmed/payment processed)

Call redeem to permanently mark the code as used. Do this only after the transaction is complete.

**Request:**
```
POST /api/promo/redeem
Content-Type: application/json
x-promo-api-key: YOUR_API_KEY

{
  "code": "CBUSA-R7K2NP",
  "redeemingSite": "sacredwellness",
  "redeemedBy": "patient@example.com"
}
```

`redeemedBy` should be the customer's email or user ID in your system for audit purposes.

**Success Response:**
```json
{
  "success": true,
  "code": "CBUSA-R7K2NP",
  "sourceSite": "chronicdocs",
  "redeemingSite": "sacredwellness",
  "patientEmail": "patient@example.com",
  "redeemedBy": "patient@example.com",
  "redeemedAt": "2026-03-11T21:00:00.000Z"
}
```

**Error responses:**
| HTTP Status | Meaning |
|-------------|---------|
| 401 | Invalid or missing API key |
| 404 | Code not found |
| 409 | Code already redeemed (race condition guard) |
| 410 | Code expired |
| 500 | Server error — retry once, then contact ChronicDocs |

---

## Reward Types Reference

The `rewardType` field tells your system what kind of discount to apply.
Your site is responsible for actually applying the discount — ChronicDocs just tells you what to give.

| rewardType            | rewardValue meaning | Example description |
|-----------------------|---------------------|---------------------|
| `percent_discount`    | Percentage (0-100)  | "10% off your first month" |
| `fixed_discount`      | Dollar amount       | "$20 off your order" |
| `free_month_premier`  | N/A (0)             | "Free month of Premier membership" |
| `free_service`        | N/A (0)             | "One free ESA letter" |
| `custom`              | N/A                 | Read `rewardDescription` for instructions |

Always display `rewardDescription` verbatim to the customer — it is the owner-approved text.

---

## No-Reward Codes

If the owner has not configured a reward for the source → your site combination, the `reward`
field will be `null` in the validate response. You can choose to:
- Still accept the code and give a default fallback reward you define on your end
- Decline the code with a message like "This code is not valid on our site yet"

Either approach is acceptable — ChronicDocs does not enforce this behavior.

---

## Testing Your Integration

Before going live, test with the following scenarios:

1. **Valid code** — validate then redeem, confirm reward is returned and code is marked used
2. **Already redeemed** — try to validate the same code again, confirm `valid: false`
3. **Bad API key** — confirm 401 is returned
4. **Nonexistent code** — use `CBUSA-000000`, confirm `valid: false` with "Code not found"
5. **Wrong site ID** — use an unrecognized `redeemingSite`, confirm `reward: null` is handled

Contact ChronicDocs for test code generation during your integration development.

---

## Issuing Codes From Your Site (Optional)

If your site also wants to generate CBUSA codes for your own customers (so they can use them
on ChronicDocs and other network sites), contact ChronicDocs to discuss the API extension for
code issuance. This requires an additional setup step on the ChronicDocs side to configure
what reward your site's codes give on each network site.

---

## Support & Contact

For API key requests, reward configuration, or integration support:
- Contact the ChronicDocs team directly
- All reward rules are configured from the ChronicDocs owner panel — no code changes required

---

*Document version: 1.0 — ChronicBrandsUSA Partner Network*
