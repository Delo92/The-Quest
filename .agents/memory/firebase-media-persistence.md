---
name: Firebase media persistence
description: The Quest media URLs are owned by Firebase records and must not be rewritten by startup initialization.
---

Media records are the source of truth for uploaded assets. Server startup must read those records only; it must not run seed or synchronization routines that create, replace, or normalize media records.

**Why:** A startup write can replace a valid saved media URL with an empty or null default, leaving the asset present but unreachable by the application.

**How to apply:** Keep media initialization out of the web server startup path. Any migration or repair of existing records must be an explicit, one-time, reviewed operation—not an automatic restart hook.