---
name: Contestant video storage
description: How Vimeo video URIs are stored and retrieved for contestant profiles — the fast path vs. the slow fallback.
---

## Rule
Contestant video ownership is competition-scoped: `competitionVideoUris[competitionId]` is authoritative. Never treat the flat `videoUrls` list as applying to every competition. Legacy fallback may inspect only that competition's folder.

**Why:** A profile-global video list makes the same clip appear in every competition and cannot support one independent video slot per entry. A direct competition-keyed Vimeo URI is fast and avoids cross-competition leakage.

## How to apply
- Uploads, replacements, deletes, and renames must validate approved contestant membership for the target competition.
- A replacement updates only that competition's map entry; remove or hide its former video without touching other entries.
- Public resolvers use the mapped URI first, then only the matching competition folder for legacy records; never backfill or reuse the flat list across competitions.
- Stage submissions remain separate from the one active contestant-library video slot; photo behavior is unchanged.

