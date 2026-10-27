---
name: Competition media sharing
description: The user's expectation for competition-specific browser icons and link-share media.
---

Every public competition link should use that competition's cover artwork for its browser favicon. For Facebook-style sharing, the user wants a standard clickable image-and-title card like DistroKid's example, using the competition video's Vimeo poster as the image; the video remains on the competition page rather than being advertised as an inline social player. Its saved cover video is primary, with the first configured promo video as fallback. Keep server metadata and client navigation metadata aligned.

**Why:** The user compared the Facebook comments directly and said they want the competition URL to work like DistroKid. The example is a clickable artwork/title card, not an iframe.

Keep the competition URL copyable; do not add a Facebook-specific share button unless requested. Facebook still controls comment linkification and cache refresh, so do not promise that page metadata alone makes a posted comment clickable.

**How to apply:** Use a normal website link card with the competition poster and title, retain video playback on the destination page, and verify the Facebook scrape after the production host is updated.

Keep competition sharing to two clearly labeled URLs: one public competition-page link that carries the selected video/share data, and one host-referral link that tracks nominations and votes. Do not add separate player-URL or iframe-code fields unless explicitly requested.

**Why:** The user wants the useful video and share metadata combined under the public page link rather than four separate copy fields; a separate embed snippet was out of scope.

Contestant profile share links should use the original profile photo as the preview image, or the competition image when the profile has no photo. If the contestant has a video, keep its direct MP4/player metadata so platforms can embed it separately from the preview image. Clearly identify profile/video shares.

**How to apply:** Keep the cover image as the competition favicon, use the contestant photo then competition artwork for profile preview images, and retain video tags for contestant profiles separately. Label the competition-page and host-referral links by purpose.

When the user compares multiple competition links and says only one has a video, identify and investigate that link; do not treat the other competition's lack of video as a defect or ask them to attach one unless they request it.

**Why:** The user clarified that Starr Struck was not expected to have a video; the identified video link was Chronic Cuties of Hawaii.

**How to apply:** Follow the user's link/image identification precisely and keep any unrelated competition data out of scope.
