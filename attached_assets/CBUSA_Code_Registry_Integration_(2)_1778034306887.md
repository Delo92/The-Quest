# ChronicDocs → Chronic Brands USA: Code Registry Integration Proposal

**Prepared by:** ChronicDocs (Chronic Brands USA Partner)
**Date:** March 2026
**Contact:** ChronicDocs Admin Team

---

## Overview

ChronicDocs maintains its own set of referral and affiliate codes tied to specific individuals — agents, affiliates, and brand partners. These codes are actively shared and circulate across the broader CBUSA partner network.

The problem today: when one of these codes is used on a **different** partner site and that site sends a redemption webhook to the CBUSA promo tracker, CBUSA has no way to know who owns the code. It arrives as an anonymous code string.

**What we're asking CBUSA to build:** A **Code Registry endpoint** — a way for ChronicDocs to proactively register all of its codes with CBUSA so that any incoming redemption webhook using a ChronicDocs code (from any site) is automatically matched to the correct owner.

---

## How It Works Today (The Gap)

```
Patient gets code "DEANA" from Owner DEANA (ChronicDocs)
         ↓
Patient uses "DEANA" at checkout on a different CBUSA partner site
         ↓
That partner site sends redemption webhook to CBUSA
         ↓
CBUSA receives: { code: "DEANA", brandName: "OtherSite", ... }
         ↓
❌ CBUSA has no record of "DEANA" — cannot attribute it to anyone
```

---

## How It Should Work (After This Integration)

```
ChronicDocs registers "DEANA" → owner: Owner DEANA, email: agent@email.com
         ↓
Patient uses "DEANA" on any CBUSA partner site
         ↓
That partner sends redemption webhook to CBUSA with code "DEANA"
         ↓
✅ CBUSA auto-matches "DEANA" to Owner DEANA from ChronicDocs
   → Correct attribution, correct payout calculation
```

---

## What We're Asking CBUSA to Build

### New Endpoint: `POST /api/code-registry/register`

This endpoint would allow ChronicDocs (and any other partner) to register a code along with the owner's details. When CBUSA receives a redemption webhook, it looks the code up in this registry first to get the attribution.

**Headers:**
```
Content-Type: application/json
x-api-key: PARTNER_API_KEY
```

**Request Body:**
```json
{
  "code": "DEANA",
  "ownerName": "Owner DEANA",
  "ownerEmail": "owner-deana@example.com",
  "ownerPhone": "5802200544",
  "sourcePlatform": "ChronicDocs",
  "status": "active"
}
```

**Response (success):**
```json
{
  "registered": true,
  "code": "DEANA",
  "message": "Code registered and will be auto-matched on all future redemptions"
}
```

**Response (code already claimed by another partner):**
```json
{
  "registered": false,
  "code": "DEANA",
  "message": "Code already registered by another partner — contact CBUSA admin to resolve"
}
```

---

### New Endpoint: `POST /api/code-registry/sync` (Bulk)

For the initial push of all existing ChronicDocs codes in one call.

**Request Body:**
```json
{
  "sourcePlatform": "ChronicDocs",
  "codes": [
    { "code": "CHRONICLOUNGE", "ownerName": "Owner CHRONICLOUNGE",    "ownerEmail": "owner-chroniclounge@example.com", "status": "active" },
    { "code": "CHRONICCALI",   "ownerName": "Owner CHRONICCALI",   "ownerEmail": "owner-chroniccali@example.com",            "status": "active" },
    { "code": "DACHRONICDON",  "ownerName": "Owner DACHRONICDON",  "ownerEmail": "owner-dachronicdon@example.com",     "status": "active" },
    { "code": "BROADWAYSMOKE", "ownerName": "Owner BROADWAYSMOKE",    "ownerEmail": "owner-broadwaysmoke@example.com",         "status": "active" },
    { "code": "BHADMARY",      "ownerName": "Owner BHADMARY",   "ownerEmail": "owner-bhadmary@example.com",     "status": "active" },
    { "code": "IRIEY",         "ownerName": "Owner IRIEY", "ownerEmail": "owner-iriey@example.com",  "status": "active" },
    { "code": "DEANA",         "ownerName": "Owner DEANA",     "ownerEmail": "owner-deana@example.com",           "status": "active" },
    { "code": "CHRONICTV",     "ownerName": "Owner CHRONICTV",        "ownerEmail": "owner-chronictv@example.com",  "status": "active" },
    { "code": "KRAZYDAISY",    "ownerName": "Owner KRAZYDAISY",     "ownerEmail": "owner-krazydaisy@example.com",           "status": "active" },
    { "code": "HOOLIGANBEAN",  "ownerName": "Owner HOOLIGANBEAN",      "ownerEmail": "owner-hooliganbean@example.com",        "status": "active" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "registered": 10,
  "skipped": 0,
  "conflicts": []
}
```

---

## How Matching Works on Redemption

Once the registry exists, when CBUSA receives any redemption webhook:

```
Incoming webhook: { code: "DEANA", brandName: "SomeOtherSite", ... }
         ↓
CBUSA looks up "DEANA" in code registry
         ↓
Found: { ownerName: "Owner DEANA", sourcePlatform: "ChronicDocs" }
         ↓
Redemption is attributed to Owner DEANA / ChronicDocs
even though it was redeemed on a completely different site
```

---

## ChronicDocs' Side: What We Will Build

Once CBUSA provides the registry endpoint:

1. **Auto-register on code creation** — Every time a new referral code is created in ChronicDocs, we immediately call `POST /api/code-registry/register` to register it with CBUSA.

2. **Initial bulk sync** — We call `POST /api/code-registry/sync` once to register all 18+ existing codes.

3. **Status sync** — If a code is deactivated in ChronicDocs, we send an update to keep CBUSA's registry in sync.

---

## Summary of What CBUSA Needs to Do

| Action | Details |
|---|---|
| Build `POST /api/code-registry/register` | Single-code registration endpoint |
| Build `POST /api/code-registry/sync` | Bulk registration endpoint |
| Add registry lookup to redemption webhook handler | Before logging a redemption, look up the code in the registry and attach owner info |
| Return the registry API URL and confirm the x-api-key | ChronicDocs already has the API key — same one used for the redemption webhook |

---

## Questions for CBUSA

1. Does a code registry concept already exist in your system under a different name?
2. Should the same `x-api-key` be used, or will code registration use a separate key?
3. What happens if two partner sites try to register the same code? First-come-first-served, or admin resolution?
4. Will registered codes appear in the CBUSA admin dashboard under a "Code Registry" or "Partners" section?
