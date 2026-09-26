---
name: OC social profile sync
description: Eligibility and contact-field rules for Quest host and contestant social scanning records sent to Original Concepts
---

# OC social profile sync

Send host and active-contestant profiles to OC when at least one valid social URL is attached to the Quest account or talent profile. Email is optional and should be represented as `null` when unavailable; it must not be a gate for social scanning.

**Why:** Social scan eligibility comes from having a social account to scan, not from having an email address. Requiring email excluded profiles that could still be scanned.

**How to apply:** Keep social URLs attached to the correct host/contestant account. Do not use a nominator's or unrelated submission contact data to fill a profile. Do not send profiles with no social URLs unless OC explicitly supports useful scanning from other fields.