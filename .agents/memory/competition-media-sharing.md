---
name: Competition media sharing
description: The user's expectation for competition-specific browser icons and link-share media.
---

Every public competition link should use that competition's cover artwork for both its browser favicon and `og:image`. Its saved cover video should be the primary share video, with the first configured promo video as fallback. Use Vimeo's returned player, poster, dimensions, and available MP4 stream metadata rather than inferring them from filenames. Keep server-rendered crawler metadata and client-side navigation metadata consistent. Social platforms may choose whether they display the video inline; the app can provide correct metadata but cannot force a platform's rendering choice.

**Why:** The user explicitly wants every competition link to carry that event's identity and hype video rather than CB Publishing's global branding, and clarified that Vimeo supplies the video's actual share format.

Competition-page links and embeddable-player links are separate products: social crawlers may use the poster even when video metadata exists, so provide a distinct player URL and copyable iframe embed code for websites.

**Why:** The user expects a literal playable video embed, not only Open Graph metadata or a link to a competition page; Messenger and text-message preview behavior is controlled by the platform.

**How to apply:** Make changes for all non-draft competition pages, not one named event. Keep the cover image in the preview as the video poster, include video metadata separately, and expose the player URL/embed code in sharing controls.

When the user compares multiple competition links and says only one has a video, identify and investigate that link; do not treat the other competition's lack of video as a defect or ask them to attach one unless they request it.

**Why:** The user clarified that Starr Struck was not expected to have a video; the identified video link was Chronic Cuties of Hawaii.

**How to apply:** Follow the user's link/image identification precisely and keep any unrelated competition data out of scope.
