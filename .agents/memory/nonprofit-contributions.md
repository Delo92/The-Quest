---
name: Mandatory nonprofit contributions
description: Policy decisions for role-specific nonprofit contributions, acknowledgments, and prize payout readiness.
---

## Rule
Contestant, host, and platform contributions are separate rates applied to each role's own share. Each required rate must be greater than 0% and no more than 10%; administrators configure the actual rates and platform recipient. Do not guess defaults. Nomination/application submission requires a current policy acknowledgment, and the accepted rates and recipient are recorded with the submission. Contestants and hosts may save declarations progressively, but prize payouts require a nonprofit name and a new affirmative `programAcknowledged` value. Legacy `consentToDonate` remains historical and does not satisfy that requirement. Payouts are recorded manually; the app does not initiate transfers.

**Why:** The contribution bases and acknowledgments are distinct by role, and a prior generic consent cannot establish acceptance of the current policy. Missing rates or declarations must not silently authorize financial activity.

**How to apply:** Keep join/nomination disclosures, profile declarations, payout eligibility, admin financial views, and audit records aligned. If any required rate or platform recipient is missing, fail closed rather than substituting a rate.