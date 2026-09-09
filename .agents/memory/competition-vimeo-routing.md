---
name: Competition Vimeo routing
description: Rules for routing contestant video uploads to the single ChronicTV competition folder
---

Talent video uploads use exactly one Vimeo destination: ChronicTV > Originals > CB Publishing The Quest > the competition folder. If a competition has an explicit vimeoFolderUrl, that exact folder overrides discovery. All contestants in a competition share that folder; no artist-level subfolders are created.

**Why:** Vimeo's broad /me/projects listing mixes duplicate Team library and My library trees, so name-based root discovery can route uploads to the wrong library. The competition setting is the authoritative destination, with the canonical My library ChronicTV root as the fallback.

**How to apply:** Use the configured competition folder for both self-service and admin upload tickets and video-listing limits. If unset, use the explicit canonical My library ChronicTV root rather than scanning ambiguous project roots. Treat folder creation/access failures as ticket errors; never continue by omitting `folder_uri`. Match videos by the competition/contestant name prefix when listing.