---
name: Competition Vimeo routing
description: Rules for routing contestant video uploads to the single ChronicTV competition/artist folder
---

Talent video uploads use exactly one Vimeo destination: ChronicTV > Originals > CB Publishing The Quest > the competition folder > the artist folder. Quest, custom-folder, and other backup copies are not created.

**Why:** The artist and admin upload flows must create one video per upload, and the ChronicTV hierarchy is the required publishing destination.

**How to apply:** Use the ChronicTV folder ticket for both self-service and admin uploads. Treat folder creation/access failures as ticket errors; never continue by omitting `folder_uri`.