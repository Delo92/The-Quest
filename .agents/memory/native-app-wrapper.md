---
name: Native app wrapper
description: How the iPhone/Android apps are built from the web app and how video playback differs from the website.
---

Apps are Capacitor shells that load the live site (server.url from SITE_URL, scheme added if missing). Website keeps the Vimeo embed; only the native app uses AVPlayer/ExoPlayer via a video-player plugin fed HLS from /api/app/playback/<category>/<comp>/<talent>, which reuses the shared 23-hour Vimeo play-URL cache. The embed stays as the fallback whenever no stream is ready.

**Why:** User wants Netflix-level video in apps using Vimeo HLS (paid plan confirmed, and the site already fetches HLS links). Video bytes come from Vimeo's CDN, so Render caching only removes the address lookup.

**How to apply:** Do not change the web player to HLS (see Vimeo playback architecture). Native builds cannot be made or tested in Replit; the owner builds on a Mac. Apple in-app-purchase rules for selling votes are an open decision.
