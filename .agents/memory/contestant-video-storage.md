---
name: Contestant video storage
description: How Vimeo video URIs are stored and retrieved for contestant profiles — the fast path vs. the slow fallback.
---

## Rule
Read contestant videos from `TalentProfile.videoUrls` (Firestore). Never walk the Vimeo folder tree (ChronicTV → Originals → Quest → Competition → Artist) at page-load time — that is 5 sequential API calls (~1s each).

**Why:** The folder walk was the original implementation, causing 4–5s delays on every contestant profile page load. Firestore already had a `videoUrls: string[]` field on TalentProfile that was never being populated.

## How to apply
- **Upload finalization** (`POST /api/vimeo/finalize-upload`): after Vimeo confirms the upload, append the `videoUri` to `TalentProfile.videoUrls` in Firestore.
- **Delete** (`DELETE /api/vimeo/videos/:videoId`): remove the URI from `videoUrls` (and add to `hiddenVideoUris` if Vimeo delete fails).
- **Video endpoint** (`GET /api/resolve/:categorySlug/:compSlug/:talentSlug/videos`): read `talentProfile.videoUrls`, filter hidden, fetch each by `getVideoById(id)` in parallel. Only fall back to `listTalentVideos` (folder walk) if `videoUrls` is empty.
- **Backfill**: if contestants already have Vimeo videos but empty `videoUrls`, run a Firestore update script using the competition video cache as the source of URIs.

## Timing after fix
- Cold first load per contestant: ~0.5s (one direct Vimeo GET by video ID)
- Server-cached subsequent loads: ~0.001s
- Previously: 4–5s (folder tree walk)
