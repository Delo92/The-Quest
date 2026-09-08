---
name: Contestant invitation links
description: URL, login, and preview behavior for contestant invitations
---

Contestant invitation links must use the Quest base path and login route: `/thequest/login?invite=...`. The token endpoint supplies competition metadata for the login banner and social preview, and the authenticated login flow marks the invitation accepted.

**Why:** The previous root `/register` URL landed outside the Quest router, treated pre-created contestants as registrants, and produced generic CB Publishing link previews.

**How to apply:** Preserve the `/thequest/login` base path in generated links and emails. Keep invitation tokens pending until the invited email successfully logs in; do not expect deleted or missing tokens to recover competition metadata.