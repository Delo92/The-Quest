---
name: Competition Vimeo routing
description: Rules for routing contestant video uploads to optional competition-specific Vimeo folders and standard backups
---

An optional Vimeo folder link may be stored on a competition. When present, talent uploads receive a copy in that folder while the standard Quest and CB Publishing destinations remain backup copies. When absent, the standard destinations are used.

**Why:** The project needs a competition-specific delivery folder without losing the existing default backup coverage, and silent uploads to the Vimeo account root are unacceptable.

**How to apply:** Validate the folder link and confirm folder access before issuing upload tickets. Treat any required-folder failure as a ticket error; never continue by omitting `folder_uri`.