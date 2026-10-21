---
name: Vimeo embed privacy
description: Vimeo privacy constraint affecting public hero-gallery playback.
---

An unlisted Vimeo cover must retain its `h` access hash, but Vimeo can still reject playback when the video is hidden from Vimeo (`privacy.view: disable`) or the video is restricted to an embed whitelist (`privacy.embed: whitelist`) that does not include the current site domain. The player can return HTTP 403 with a `PrivacyError` even when the iframe URL and access hash are correct.

**Why:** The player can return Vimeo’s privacy error even with the correct video ID and unlisted hash; application code cannot override Vimeo’s privacy policy, and 5G does not change a server-side privacy denial.

**How to apply:** Keep the hash when constructing player URLs, then verify Vimeo’s embed setting allows the app’s preview and published domains. Keep the competition poster visible when Vimeo blocks the player rather than treating the video as missing.

Do not infer that contestant videos are failing from an error on a different Vimeo iframe, such as the competition cover video. Identify the exact media URL before changing contestant-card playback.

**Why:** A failure on one competition video does not establish that other video embeds are failing; changing working contestant previews based on that assumption risks unrelated regressions.

**How to apply:** Match browser errors to the specific iframe and route they came from, then preserve contestant video behavior unless there is direct evidence about that media.