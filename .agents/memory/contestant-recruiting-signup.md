---
name: Contestant recruiting signup
description: Scope boundaries for competition-branded contestant recruiting links.
---

A competition recruiting link is an attribution source, not a competition entry application. Registration must create only a contestant account and public talent profile, record the source competition ID, and never charge or create a contestant entry. Do not offer viewer, host, or admin account registration on the recruiting form. Reuse the global talent profile, dashboard media tools, and later nomination flow; keep contact details private and resolve them server-side when needed for nominations.

Public portfolio links use a readable stage-name slug plus the stable profile ID, such as `/thequest/vivian-40`. Do not make the personal portfolio URL depend on a competition path or expose only an opaque numeric ID.

**Why:** The user explicitly narrowed the flow to simple, free contestant signup after earlier scope creep, and specifically requested personal portfolio links that identify the contestant by name.

**How to apply:** Follow this boundary for recruiting links, signup copy and behavior, all public-profile share links, and later nominations. Preserve old numeric links by resolving them to the named portfolio path.
