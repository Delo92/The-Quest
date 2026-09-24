---
name: Owner dashboard analytics
description: Role-scoped visitor and play metrics shown to hosts and talent users
---

## Rule

Use the generic labels “Website visitors” and “Unique plays” in owner dashboards. Do not expose analytics-provider names in dashboard copy. Visitor totals cover the last 30 days and are deduplicated across the exact public paths in the user's scope. Lifetime play totals use existing per-video counts and sum each distinct video ID once; they are play counts, not unique viewers. Host scope is their created competitions and approved entries. Talent scope is only their own approved entries.

**Why:** The user confirmed existing per-video counts are sufficient and explicitly requested provider-neutral labels.

**How to apply:** Keep ownership derived from the authenticated account, reuse current video counts, and preserve these metric labels and periods in future dashboard changes.