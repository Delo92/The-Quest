---
name: Contestant video storage
description: How Vimeo video URIs are stored and retrieved for contestant profiles — the fast path vs. the slow fallback.
---

## Rule
Contestant video ownership is competition-scoped. The saved competition URI selects the featured video; it must not limit the artist's competition profile to one clip. Include all of that artist's visible uploads in the selected competition's Vimeo folder. Never treat the flat `videoUrls` list as applying to every competition.

**Why:** The user clarified that an artist may have multiple uploads for the same competition and all belong in that competition profile's media gallery alongside the photos. A profile-global list would leak clips between unrelated competitions.

## How to apply
- Uploads, replacements, deletes, and renames must validate approved contestant membership for the target competition.
- A replacement updates only that competition's map entry; remove or hide its former video without touching other entries.
- Public resolvers put the mapped URI first and merge all artist-matching clips from only that competition's folder, deduplicating videos and respecting hidden entries. Never backfill or reuse the flat list across competitions.
- Stage submissions remain separate from the one active contestant-library video slot; photo behavior is unchanged.

