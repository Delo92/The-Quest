---
name: Admin profile media
description: Rules for admin-managed photos and talent videos
---

Admin-managed profile photos may be added without a competition and are stored against the talent profile. Admin-managed videos must select a competition before a Vimeo upload ticket can be created, but the user does not need to already be assigned to that competition.

**Why:** Photos are part of the reusable talent profile, while videos are routed into one competition-specific ChronicTV folder. Admins may need to prepare media before contestant assignment.

**How to apply:** Preserve the optional competition behavior for photos and require only a valid selected competition for admin video upload or routing changes.

Admin video uploads use the same single ChronicTV destination as artist self-service uploads; there are no backup copies.

**Why:** Admin-managed media should behave exactly like the artist upload flow and create only one Vimeo video.

**How to apply:** Require a selected competition, create the ChronicTV competition/artist folder ticket, and list videos from that same folder.

The admin media competition selector must remain empty until the administrator explicitly chooses a competition; upload completion should wait for the uploaded Vimeo URI to appear in the listing before showing it as visible.

**Why:** Defaulting to the first competition can route media incorrectly, and Vimeo indexing can lag behind upload completion.

**How to apply:** Block video upload when no competition is selected and poll the selected folder briefly after finalization.

Admin can create profile-only talent records without email or login credentials; these records can still be assigned to a competition and receive admin-managed media.

**Why:** Some talent submissions arrive with names and media only, so inventing login credentials or sending invitations is inappropriate.

**How to apply:** Use a non-login internal profile identity, set role to talent, and create the approved competition assignment before adding media.