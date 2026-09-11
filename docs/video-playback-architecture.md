# The Quest — Video Playback Architecture Breakdown
*Prepared for Chronic TV technical exchange · September 2026*

---

## Overview

The Quest uses a layered, context-aware video strategy. Rather than one player for everything, each surface (gallery, contestant profile, background loop, full playback) uses the mechanism that gives the best result for that context — native `<video>`, Vimeo iframe embed, or a signed HLS stream through a custom player. Mobile behavior is handled explicitly at every layer.

---

## 1. Player Selection by Context

| Surface | Mechanism | Why |
|---|---|---|
| Hero gallery card overlay | Vimeo iframe (muted, background mode) | Guaranteed autoplay across browsers; thumbnail stays visible underneath as fallback |
| Contestant share / spotlight | Vimeo iframe, click-to-play | User intent required; Vimeo controls handle quality/fullscreen |
| Talent profile (public) | Vimeo iframe, autoplay muted loop | Ambient, decorative; no controls needed |
| Competition detail first video | Vimeo iframe, autoplay muted | Same ambient pattern; lazy-mounted |
| Full screened / admin playback | Custom HLS player (`HlsVideoPlayer`) | Signed URL, adaptive bitrate, no Vimeo watermark |
| Section background loops | Native `<video>` or Vimeo iframe via `MediaSlot` | CSS background fill; pointer-events off |

The rule: **Vimeo iframe for ambient/autoplay surfaces, custom HLS player only when the user explicitly opens full playback.**

---

## 2. Vimeo Iframe Embed Params

Every embed uses a consistent param set. Deviating from this causes autoplay failures, especially on mobile.

```
autoplay=1
muted=1
loop=1
autopause=0
background=1      ← disables Vimeo's own controls and click-to-pause
controls=0
title=0
byline=0
portrait=0
```

`background=1` is the critical one. Without it, Vimeo's UI sits on top of your layout and mobile autoplay is less reliable.

For click-to-play surfaces (contestant share page), `autoplay` and `background` are off; `controls=1` is on and the user initiates play.

`dnt=1` (do not track) is added on pages where user privacy is a concern (talent dashboard).

---

## 3. Thumbnail-First Layering in the Gallery

The hero coverflow gallery never shows a blank frame while video loads. The pattern:

```
<div class="card">
  <!-- Layer 1: always rendered, always visible -->
  <img src={thumbnail} loading="eager" />

  <!-- Layer 2: video overlays absolutely on top once ready -->
  {hasDirectMp4 && <video autoPlay muted loop playsInline preload="auto" />}
  {hasVimeoEmbed && isInView && <iframe src={vimeoEmbedUrl} loading="lazy" />}
</div>
```

Key decisions:
- `loading="eager"` on the thumbnail. Lazy loading inside CSS 3D-transformed containers fails on mobile — the browser can't determine in-viewport status under `perspective` transforms.
- `transform-style: preserve-3d` was **removed** from the card element. iOS Safari silently disables it when `overflow: hidden` is on the same element, causing cards to disappear or render incorrectly.
- The iframe is only mounted when the gallery is in the viewport (IntersectionObserver, threshold 0.45). When the gallery scrolls out of view, the iframe is unmounted — freeing memory.
- If the iframe fails, the thumbnail beneath it remains. The video is decoration; the thumbnail is truth.

---

## 4. Lazy Mount / Unmount Pattern (IntersectionObserver)

Used in two places: the hero gallery and individual video cards on the competition detail page.

```ts
// hero-coverflow-gallery.tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsInView(entry.isIntersecting),  // toggle, not latch
    { threshold: 0.45 }
  );
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);
```

**The toggle vs. latch distinction matters.** Setting `setVisible(true)` and never setting it back to `false` means all 10–12 gallery cards load their iframes into RAM simultaneously as the user scrolls past them. The observer must set `false` on exit or you accumulate players. We fixed a bug where this was latching — memory usage dropped significantly after the fix.

For competition detail cards, the iframe is wrapped in a `LazyVimeoIframe` component with `rootMargin: '200px'` — it starts loading 200px before the card enters the viewport so there's no blank-frame flash on scroll.

---

## 5. Custom HLS Player (Full Playback)

`HlsVideoPlayer` is used when a user opens a video for full playback (not ambient). Flow:

1. Component mounts → calls `/api/vimeo/:id/play` on the server
2. Server hits Vimeo API for signed HLS and progressive MP4 URLs, caches for 23 hours
3. Browser capability check:
   - **Safari / iOS**: `canPlayType('application/vnd.apple.mpegurl')` → native HLS, set `src` directly
   - **All others**: dynamically import `hls.js`, attach to `<video>` element
   - **Fallback**: highest-quality progressive MP4 if HLS fails entirely
4. `playsInline` is always set — without it, iOS forces fullscreen on play

```ts
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = hlsUrl;
  video.load();
} else {
  const { default: Hls } = await import('hls.js');
  const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
  hls.loadSource(hlsUrl);
  hls.attachMedia(video);
}
```

---

## 6. Video Preloading Hook

For surfaces where a video is about to be shown (e.g. the user is browsing toward it), `useVideoPreloader` buffers the first segments before the player mounts:

- Creates a hidden 1px offscreen `<video>` element
- Safari: sets native HLS src and calls `.load()`
- Others: imports hls.js and begins buffering
- When the real `HlsVideoPlayer` mounts, it detaches hls.js from the preloader and attaches it to the visible `<video>` — no re-download, no blank frame

---

## 7. Muted Autoplay & Audio Unlock

Browsers block autoplay with sound. The pattern used throughout:

- All ambient/background embeds: `muted=1` in params, `background=1` mode
- User can click to unmute — two strategies depending on context:
  - **Native video**: toggle `.muted` property directly
  - **Vimeo iframe**: first click remounts the iframe with `muted=0`; subsequent clicks send `postMessage` to `https://player.vimeo.com` with `{ method: 'setVolume', value: 1 }`

```ts
// postMessage approach for already-mounted iframes
iframeRef.current?.contentWindow?.postMessage(
  JSON.stringify({ method: 'setVolume', value: isMuted ? 0 : 1 }),
  'https://player.vimeo.com'
);
```

---

## 8. Service Worker — Video Exclusions

The service worker uses stale-while-revalidate for app shell assets (JS, CSS, fonts, images). Video is explicitly excluded:

```js
// sw.js — never cache these
const BYPASS = [
  '/api/',
  'player.vimeo.com',
  'vimeocdn.com',
  'akamaized.net',   // Vimeo CDN
  'firebasestorage.googleapis.com',
];

if (BYPASS.some(p => url.href.includes(p))) {
  return fetch(request); // straight to network
}
```

Caching video through a service worker causes stale playback, broken range requests (seek fails), and unbounded cache growth. All video is network-only.

Additionally, the SW actively **unregisters itself** on localhost and `.replit.dev` domains on every page load:

```js
if (hostname === 'localhost' || hostname.includes('.replit.dev')) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()));
}
```

Skipping registration alone isn't enough — a previously registered SW continues to intercept requests. Active unregistration ensures Vite HMR and dev video requests are never intercepted.

---

## 9. Mobile-Specific Rules Applied

| Problem | Fix Applied |
|---|---|
| Lazy images don't load inside 3D-transformed containers | `loading="eager"` on gallery thumbnails |
| `preserve-3d` + `overflow: hidden` breaks compositing on iOS | Removed `transform-style: preserve-3d` from card element |
| Forced fullscreen on play | `playsInline` on every `<video>` element |
| Autoplay blocked with audio | `muted` on all ambient players; audio unlocked on user gesture only |
| `background-attachment: fixed` not supported in iOS scroll containers | Replaced with `background-image` CSS on a static div |
| Gallery card overlap not proportional on small screens | `translateX` uses `offset * (cardWidth * 0.72)` where `cardWidth` is viewport-responsive (170px / 200px / 260px) |
| Portrait vs landscape video | Aspect ratio selected per video: `aspect-[9/16]` for portrait, `aspect-video` for landscape |

---

## 10. Vimeo Server-Side (Storage & Upload)

- All contestant videos upload to Vimeo via TUS protocol, scoped to a per-competition folder
- Folder naming: `{competitionId}-{competitionTitle}` — predictable, no folder-tree walking at page load
- Video URLs are stored on the talent's Firestore profile (`videoUrls[]`) and read from there — the app never walks the Vimeo folder tree at runtime
- Server caches signed play URLs for 23 hours (`vimeo.ts`)
- Direct ambient URLs prefer 360p → 480p (low bandwidth for background loops)

---

## Summary: The Core Principles

1. **Thumbnail first, video on top.** Never show a blank frame. The thumbnail is the guaranteed state; video is an enhancement.
2. **Mount late, unmount on exit.** IntersectionObserver gates iframe creation. Toggle visibility — never latch — or you accumulate players in RAM.
3. **Muted everywhere ambient.** Autoplay with audio fails on every mobile browser. Unlock audio only on explicit user gesture.
4. **Vimeo iframe for ambient, custom player for full playback.** Don't mix them.
5. **Service worker never touches video.** Explicitly bypass all streaming domains.
6. **Mobile is a first-class target, not an afterthought.** Safari HLS, `playsInline`, `loading="eager"` inside transforms, and proportion-relative card offsets are all deliberate.
