---
name: Host contestant admin scope
description: Hosts reuse the admin User Profile dialog for contestants in their own events; scope, privacy and URL rules
---
Hosts open the shared talent detail dialog (scope="host") served by /api/host/users/... routes that share handlers with /api/admin/users/... via a per-request event-membership check.
**Why:** hosts need admin-style control only inside events they created; never other hosts, admins, themselves, or other events.
**How to apply:** new contestant-management routes must use the shared scope middleware, not requireHost alone. Phone and text opt-in live in a private collection (never on the public profile object). Hosts get password reset and audit-logged access views; photos/bio stay view-only. The public Linktree page is /thequest/talent/:id; /thequest/Competitor/{StageName} resolves by name to it.
