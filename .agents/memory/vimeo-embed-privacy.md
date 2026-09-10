---
name: Vimeo embed privacy
description: Vimeo privacy constraint affecting public hero-gallery playback.
---

An unlisted Vimeo cover must retain its `h` access hash, but Vimeo can still reject playback when the video is not allowed to be embedded or the current site domain is not on its allowed-domain list.

**Why:** The player can return Vimeo’s privacy error even with the correct video ID and unlisted hash; application code cannot override Vimeo’s privacy policy.

**How to apply:** Keep the hash when constructing player URLs, then verify Vimeo’s embed setting allows the app’s preview and published domains. Keep the competition poster visible when Vimeo blocks the player rather than treating the video as missing.