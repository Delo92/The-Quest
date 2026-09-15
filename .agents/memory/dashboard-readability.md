---
name: Dashboard readability
description: Contrast baseline for The Quest's authenticated operational dashboards.
---

Authenticated dashboards use a charcoal page surface, clearly lighter cards and form fields, visible borders, and brighter secondary text. The public site's dark visual treatment remains unchanged.

**Why:** The previous near-black page, card, and field surfaces caused eye strain and made operational controls difficult to scan during long sessions.

**How to apply:** Add the `quest-dashboard` scope to new backend dashboard shells and keep dashboard-specific surface, border, text, input, and focus styles within that scope rather than changing the public site globally.