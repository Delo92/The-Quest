---
name: Contestant invitation links
description: URL, login, and preview behavior for contestant invitations
---

Contestant invitation links must use the Quest base path and login route: `/thequest/login?invite=...`. The token endpoint supplies competition metadata for the login banner and social preview, and the authenticated login flow marks the invitation accepted.

The Quest screens run inside Wouter's nested `/thequest` router. Inside it, `useLocation()` returns a path relative to that base, while `Link` and `setLocation` apply the base during navigation. Build auth `returnTo` values and detect nested routes from `useLocation()`, not `window.location.pathname`.

**Why:** The previous root `/register` URL landed outside the Quest router, treated pre-created contestants as registrants, and produced generic CB Publishing link previews.

**How to apply:** Preserve the `/thequest/login` base path in generated links and emails. For internal auth navigation, keep paths relative to the nested Quest router so the base is applied exactly once. Keep invitation tokens pending until the invited email successfully logs in; do not expect deleted or missing tokens to recover competition metadata.

Welcome and nomination emails must contain a login button that prefills the recipient's email and correct account type. New/pre-created accounts need their actual temporary credential in the email; existing accounts need an explicit recovery option rather than a guessed password.

**Why:** The owner reported that successful nomination emails reached nominees, but recipients could not access their accounts to upload photos and videos because sign-in credentials and usable login instructions were missing.

**How to apply:** Keep passwords out of link query strings. Use the current admin-reset convention for newly created accounts, and offer safe password setup/reset instructions for existing accounts unless an admin explicitly resets them.