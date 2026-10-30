---
name: Contestant recruiting signup
description: Scope boundaries for competition-branded contestant recruiting links.
---

A competition recruiting link is an attribution source, not a competition entry application. Registration must create only a contestant account and public talent profile, record the source competition ID, and never charge or create a contestant entry. Do not offer viewer, host, or admin account registration on the recruiting form. Reuse the global talent profile, dashboard media tools, and later nomination flow; keep contact details private and resolve them server-side when needed for nominations.

For public directory status, an approved contestant record is an official entry, including zero-fee or fully discounted nominations. When no approved record exists, say “not officially entered”; do not imply a payment failed or is owed.

Public portfolio links use a readable stage-name slug plus the stable profile ID, such as `/thequest/vivian-40`. Do not make the personal portfolio URL depend on a competition path or expose only an opaque numeric ID.

Competition-entry links on a public portfolio must use the competition's canonical slug from the competition record. The portfolio competitions response must include that slug; deriving only from the title breaks links whenever a competition has a custom slug. Legacy title-derived URLs may resolve only when they uniquely identify a competition in that category.

**Why:** The user explicitly narrowed the flow to simple, free contestant signup after earlier scope creep, and specifically requested personal portfolio links that identify the contestant by name. Nominations can also be free, so profile existence or missing payment data alone cannot establish official status.

**How to apply:** Follow this boundary for recruiting links, signup copy and behavior, all public-profile share links, later nominations, and any public nomination-status labels. Preserve old numeric links by resolving them to the named portfolio path.

**Why:** A competition can have an explicit public slug that differs from its title-derived slug; omitting it creates an entry card that looks valid but points to a 404.

**How to apply:** Return the explicit slug in profile competition data, use it when building links and canonical tags, and retain only unambiguous title-slug compatibility for older links.
