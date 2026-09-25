---
name: Weekly marketing consent
description: User-approved cadence and registration behavior for contestant and host marketing-guideline consent.
---

Contestants and hosts must accept the marketing-guidelines agreement once per calendar week, with the week beginning Monday in America/Chicago. Accepting the same agreement during signup satisfies the current week; existing accounts must accept through the weekly gate before continuing. Keep the policy version synchronized between registration and the weekly ledger, and bump it when the agreement text changes.

**Why:** The user selected a Monday calendar-week reset. Requiring a new account to accept the same text again immediately after signup would be redundant.

**How to apply:** Use the Central Time week boundary for all consent reads and writes. Preserve the versioned server-side record and make signup acceptance count for the signup week.