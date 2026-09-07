---
name: Admin profile media
description: Rules for admin-managed photos and talent videos
---

Admin-managed profile photos may be added without a competition and are stored against the talent profile. Admin-managed videos must select a competition before a Vimeo upload ticket can be created, but the user does not need to already be assigned to that competition.

**Why:** Photos are part of the reusable talent profile, while videos are routed into competition-specific Vimeo folders and backup destinations. Admins may need to prepare media before contestant assignment.

**How to apply:** Preserve the optional competition behavior for photos and require only a valid selected competition for admin video upload or routing changes.

The primary Quest Vimeo upload must be finalized even if an optional ChronicTV or custom-folder backup upload fails; surface backup failures as warnings and allow Vimeo indexing time before declaring the media missing.

**Why:** A backup destination should not make the user lose an otherwise successful primary upload.

**How to apply:** Treat the primary upload and its completion URI as required, finalize completed backups independently, and refresh admin video listings with a short polling window.