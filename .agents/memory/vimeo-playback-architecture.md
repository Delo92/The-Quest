---
name: Vimeo playback architecture
description: How Vimeo content is rendered across the app and why — the decisions that affect every video component.
---

## Rule
Use Vimeo's own embed iframe (`player_embed_url`) for any video that needs controls or reliable ABR (contestant share page). Use a native `<video>` tag with a direct progressive MP4 from `resolveDirectVideoUrl()` for all background/ambient silent loops (gallery wheel, competition cards, hero sections). Never use hls.js + signed URL for content that can use either of the above.

**Why:** hls.js + signed URL requires your server to call Vimeo's API before playback can start — that's an extra round trip that makes contestant videos slow. Vimeo's embed iframe skips that entirely: the browser goes straight to Vimeo's CDN using the `player_embed_url` already in the bundle. For background video, native `<video>` eliminates Vimeo's player JS bundle (~300KB per iframe), is GPU-decoded, and the account has confirmed access to 240p–720p progressive MP4 links.

**How to apply:**
- Contestant tap-to-play videos: `<iframe src={buildVimeoSrc(video.embedUrl, "autoplay=1&controls=1&...")} />`
- Background/ambient loops: `<video src={directVideoUrl} autoPlay muted loop playsInline />` — `directVideoUrl` comes from `resolveDirectVideoUrl(vimeoUrl)` in server/vimeo.ts, cached 23h
- Hero sections (no controls): `background=1` param hides all Vimeo player chrome including mute button; `background=0` leaks the mute button even with `controls=0`
- `video.embedUrl` = `player_embed_url` from Vimeo API, already on every video object in bundle response — no extra API call needed

## Account capability confirmed
Progressive MP4 links are available on this Vimeo account: 240p, 360p, 540p, 720p all returned by `GET /api/vimeo/:id/play`. resolveDirectVideoUrl prefers 360p for background use.
