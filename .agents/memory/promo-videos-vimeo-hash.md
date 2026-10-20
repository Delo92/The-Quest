---
name: Promo videos and Vimeo access hash
description: Why competition promo videos need the Vimeo ?h= hash resolved server-side, and how hosts differ from admins.
---
Unlisted Vimeo videos fail with "Sorry, we're having a little trouble" unless the player URL carries `?h=`. The embed-url lookup route is admin-only, so host uploads/pasted links are enriched on the server when promoVideos are saved.

**Why:** hosts could not call the admin route, so their saved URLs lacked the hash.
**How to apply:** any new path that stores a Vimeo player URL must resolve the hash server-side. Vimeo pads thumbnails (`r=pad`); strip it when a thumbnail fills a portrait card.
