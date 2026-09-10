---
name: Vimeo embed privacy
description: Vimeo privacy constraint affecting public hero-gallery playback.
---

An unlisted Vimeo cover must retain its `h` access hash, but Vimeo can still reject playback when the video is hidden from Vimeo (`privacy.view: disable`) or the video is restricted to an embed whitelist (`privacy.embed: whitelist`) that does not include the current site domain.

**Why:** The player can return Vimeo’s privacy error even with the correct video ID and unlisted hash; application code cannot override Vimeo’s privacy policy.

**How to apply:** Keep the hash when constructing player URLs, then verify Vimeo’s embed setting allows the app’s preview and published domains. Keep the competition poster visible when Vimeo blocks the player rather than treating the video as missing.