---
name: Competition Vimeo routing
description: Rules for routing contestant video uploads to the single ChronicTV competition folder
---

Talent video uploads use exactly one Vimeo destination: ChronicTV > Originals > CB Publishing The Quest > the competition folder. If a competition has an explicit vimeoFolderUrl, that exact folder overrides discovery. All contestants in a competition share that folder; no artist-level subfolders are created.

New contestant video titles are user-facing metadata, not routing metadata: use the raw contestant stage/display name, followed by an optional uploader title, and omit the competition/source path and original filename/extension. Preserve punctuation such as `$`. Listing and analytics must recognize these clean names and continue supporting legacy prefixed titles.

**Why:** Vimeo's broad /me/projects listing mixes duplicate Team library and My library trees, so name-based root discovery can route uploads to the wrong library. Sanitizing `$howtime` to `_howtime` also created an offensive-looking title. The configured folder is the authoritative source association and avoids exposing path/file details in titles.

**How to apply:** Use the configured competition folder for both self-service and admin upload tickets and video-listing limits. If unset, use the explicit canonical My library ChronicTV root rather than scanning ambiguous project roots. Treat folder creation/access failures as ticket errors; never continue by omitting `folder_uri`. Match new videos by folder membership and contestant title, while retaining legacy-prefix reads.