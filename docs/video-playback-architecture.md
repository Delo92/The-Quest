# The Quest — Video Playback Architecture Breakdown
*Prepared for Chronic TV technical exchange · September 2026*

**GitHub repo:** https://github.com/Delo92/The-Quest

All line references link directly to the file and line in the repo. Line numbers are current as of this writing — if the file has changed, use the anchored link as a starting point and search nearby.

---

## 1. Player Selection by Context

Rather than one player for everything, each surface uses the mechanism that gives the best result for that context.

| Surface | Mechanism | File |
|---|---|---|
| Hero gallery card overlay | Vimeo iframe (muted, background mode) | [`hero-coverflow-gallery.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx) |
| Contestant share / spotlight | Vimeo iframe, click-to-play | [`contestant-share.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/contestant-share.tsx#L657) |
| Talent profile (public) | Vimeo iframe, autoplay muted loop | [`talent-profile-public.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/talent-profile-public.tsx#L170) |
| Competition detail first video | Vimeo iframe, autoplay muted, lazy mount | [`competition-detail.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/competition-detail.tsx#L712) |
| Full / admin playback | Custom HLS player | [`hls-video-player.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx) |
| Section background loops | Native `<video>` or Vimeo iframe via MediaSlot | [`media-slot.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/media-slot.tsx) |

**The rule:** Vimeo iframe for ambient/autoplay surfaces; custom HLS player only when the user explicitly opens full playback.

---

## 2. Vimeo Iframe Embed Params

Every embed uses a consistent param set. Deviating from this causes autoplay failures, especially on mobile.

**File:** [`media-slot.tsx` lines 139–140, 165](https://github.com/Delo92/The-Quest/blob/main/client/src/components/media-slot.tsx#L139)

```
autoplay=1
muted=1
loop=1
autopause=0
background=1      ← disables Vimeo UI, enables reliable mobile autoplay
controls=0
title=0
byline=0
portrait=0
```

`background=1` is the critical param. Without it, Vimeo's UI overlays your layout and mobile autoplay is unreliable.

When `fit="contain"` is used (letterboxed), `background` flips to `0` because Vimeo's background mode crops to fill — contain requires it off:

```ts
// media-slot.tsx L140
`autoplay=1&muted=1&loop=1&autopause=0&background=${fit === "contain" ? "0" : "1"}&controls=0&title=0&byline=0&portrait=0`
```

For click-to-play surfaces (contestant share), `autoplay` and `background` are off; `controls=1` is on.

`dnt=1` (do not track) is added on the talent dashboard:
[`talent-dashboard.tsx L1194`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/talent-dashboard.tsx#L1194)

---

## 3. Thumbnail-First Layering in the Gallery

The hero gallery never shows a blank frame while video loads.

**File:** [`hero-coverflow-gallery.tsx` lines 253–290](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L253)

```tsx
<div className="card">
  {/* Layer 1: always rendered, always visible — the guaranteed state */}
  <img src={thumbnail} loading="eager" />   {/* L263 */}

  {/* Layer 2: video overlays absolutely on top once ready */}
  {hasDirectMp4 && (
    <video autoPlay muted loop playsInline preload="auto" />  {/* L269–279 */}
  )}
  {hasVimeoEmbed && isInView && (
    <iframe src={vimeoEmbedUrl} loading="lazy" />             {/* L280–289 */}
  )}
</div>
```

**Why `loading="eager"` on the thumbnail** ([L263](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L263)):
Lazy loading inside CSS 3D-transformed containers fails on mobile — the browser can't determine in-viewport status under `perspective` transforms, so images never load. Eager forces them.

**Why `transform-style: preserve-3d` was removed** from `.coverflow-cover` ([`index.css`](https://github.com/Delo92/The-Quest/blob/main/client/src/index.css)):
iOS Safari silently disables `preserve-3d` when `overflow: hidden` is on the same element. Cards disappeared or rendered incorrectly. Removing it fixed the issue with no visual regression.

**If the iframe fails**, the thumbnail beneath it remains. The video is decoration; the thumbnail is truth.

---

## 4. Lazy Mount / Unmount Pattern (IntersectionObserver)

**File:** [`hero-coverflow-gallery.tsx` lines 60, 84–90](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L84)

```ts
const [isInView, setIsInView] = useState(false);  // L60

const observer = new IntersectionObserver(
  ([entry]) => setIsInView(entry.isIntersecting && entry.intersectionRatio >= 0.45),  // L90
  { threshold: 0.45 }
);
```

**The toggle vs. latch distinction is critical.** Setting `setIsInView(true)` and never setting it back to `false` means all gallery cards load their iframes simultaneously as the user scrolls. The observer must set `false` on exit or you accumulate players in RAM. We fixed a latching bug — memory usage dropped significantly after the fix.

For competition detail cards, a `LazyVimeoIframe` component uses `rootMargin: '200px'` to start loading before the card enters the viewport — no blank-frame flash on scroll:

**File:** [`competition-detail.tsx` lines 29–38](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/competition-detail.tsx#L29)

```ts
function LazyVimeoIframe({ src, title, className, allow }) {
  const observer = new IntersectionObserver(callback, { rootMargin: "200px" });
  // mounts iframe only when within 200px of viewport
}
```

Used at [`competition-detail.tsx L712`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/competition-detail.tsx#L712) and [`L746`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/competition-detail.tsx#L746).

---

## 5. Custom HLS Player (Full Playback)

**File:** [`hls-video-player.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx)

**File (server):** [`vimeo.ts` lines 530–555](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L530)

Flow:
1. Component mounts → calls `/api/vimeo/:id/play` on the server
2. Server hits Vimeo API for signed HLS + progressive MP4 URLs, caches for 23 hours ([`vimeo.ts L530`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L530))
3. Browser capability check at [`hls-video-player.tsx L173`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx#L173):

```ts
const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl");  // L173

if (canNativeHls) {
  // Safari / iOS — native HLS, no library needed                         // L176
  video.src = hlsUrl;
  video.load();
} else {
  // All others — dynamically import hls.js (off the initial bundle)      // L186
  const { default: Hls } = await import("hls.js");
  const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
  hls.loadSource(hlsUrl);
  hls.attachMedia(video);
}
```

`playsInline` is always set ([L266](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx#L266)) — without it, iOS forces fullscreen on play.

Dynamic `import("hls.js")` keeps hls.js off the initial JS bundle — it only loads when a user actually opens full playback. This is noted in the file header at [L5](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx#L5).

---

## 6. Video Preloading Hook

**File:** [`use-video-preloader.ts`](https://github.com/Delo92/The-Quest/blob/main/client/src/hooks/use-video-preloader.ts)

For surfaces where a video is about to be shown, this hook buffers the first segments before the player mounts:

```ts
// use-video-preloader.ts L84–103
// Safari: sets src on a hidden <video> and calls .load()
video.src = hlsUrl;
video.muted = true;
video.load();                              // browser starts buffering natively

// Other browsers: hls.js buffers on a hidden video
hls.attachMedia(hiddenVideo);             // L102
```

When the real `HlsVideoPlayer` mounts, it adopts the existing hls.js instance — no re-download, no blank frame:

```ts
// hls-video-player.tsx L111–155
// detach from preloader's hidden video, attach to the visible one
hls.detachMedia();
hls.attachMedia(visibleVideo);
```

---

## 7. Muted Autoplay & Audio Unlock

Browsers block autoplay with sound. All ambient embeds use `muted=1`. When the user clicks to unmute, two strategies are used depending on context:

**Strategy A — Vimeo iframe postMessage** (already-mounted iframes):

**File:** [`media-slot.tsx` lines 62–63](https://github.com/Delo92/The-Quest/blob/main/client/src/components/media-slot.tsx#L62)

```ts
iframeRef.current?.contentWindow?.postMessage(
  JSON.stringify({ method: "setVolume", value: next ? 0 : 1 }),
  "https://player.vimeo.com"
);
```

**Strategy B — iframe remount** (first unmute):

**File:** [`media-slot.tsx` lines 139](https://github.com/Delo92/The-Quest/blob/main/client/src/components/media-slot.tsx#L139)

On first click, the iframe is remounted with `muted=0` in the src params. Subsequent clicks use postMessage (Strategy A) so the iframe isn't destroyed on every toggle.

---

## 8. Service Worker — Video Explicitly Excluded

**File:** [`sw.js` lines 9–12, 51](https://github.com/Delo92/The-Quest/blob/main/client/public/sw.js#L9)

```js
const BYPASS = [
  "player.vimeo.com",   // L9
  "vimeocdn.com",       // L10
  "akamaized.net",      // L11  ← Vimeo's CDN
  "firebasestorage",    // L12
];
// L51: stale-while-revalidate for app shell; network-only for everything else
```

Caching video through a service worker causes stale playback, broken range requests (seek fails), and unbounded cache growth. All video is network-only.

**Active unregister on dev domains:**

**File:** [`index.html` lines 145–150](https://github.com/Delo92/The-Quest/blob/main/client/index.html#L145)

```js
var isDev = location.hostname === "localhost"
         || location.hostname.includes(".replit.dev");  // L145
if (isDev) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()));   // L149–150
}
```

Skipping `register()` alone isn't enough — a previously registered SW continues to intercept requests. Active unregistration is required or Vite HMR and dev video requests get intercepted.

---

## 9. Mobile-Specific Fixes (Reference Table)

| Problem | Fix | File & Line |
|---|---|---|
| Lazy images don't load inside 3D-transformed containers | `loading="eager"` on gallery thumbnails | [`hero-coverflow-gallery.tsx L263`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L263) |
| `preserve-3d` + `overflow:hidden` breaks compositing on iOS | Removed `transform-style: preserve-3d` from `.coverflow-cover` | [`index.css`](https://github.com/Delo92/The-Quest/blob/main/client/src/index.css) |
| Forced fullscreen on play (iOS) | `playsInline` on every `<video>` | [`hls-video-player.tsx L266`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hls-video-player.tsx#L266) |
| Autoplay blocked with audio | `muted` on all ambient players; audio unlocked on user gesture only | [`media-slot.tsx L140`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/media-slot.tsx#L140) |
| `background-attachment: fixed` invisible on iOS scroll containers | Replaced with static `background-image` CSS divs | [`landing.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/landing.tsx) / [`home.tsx`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/home.tsx) |
| Gallery card overlap not proportional on small screens | `translateX` uses `offset * (cardWidth * 0.72)` where `cardWidth` is viewport-responsive | [`hero-coverflow-gallery.tsx L214–215`](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L214) |
| Portrait vs landscape video squashed | `aspect-[9/16]` for portrait, `aspect-video` for landscape, selected per video | [`competition-detail.tsx L743`](https://github.com/Delo92/The-Quest/blob/main/client/src/pages/competition-detail.tsx#L743) |

---

## 10. Responsive Card Width Hook (Gallery)

**File:** [`hero-coverflow-gallery.tsx` lines 6–17](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L6)

```ts
function useCardWidth() {
  if (typeof window === "undefined") return 260;
  if (window.innerWidth <= 480) return 170;   // L9
  if (window.innerWidth <= 768) return 200;   // L10
  return 260;                                  // L11 — desktop
}
```

Used at [L52](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L52), then drives translateX at [L214–215](https://github.com/Delo92/The-Quest/blob/main/client/src/components/hero-coverflow-gallery.tsx#L214):

```ts
const step = Math.round(cardWidth * 0.72);   // L214 — 72% overlap ratio
const translateX = offset * step;             // L215
```

---

## 11. Vimeo Server-Side (Storage, Upload, Caching)

**File:** [`vimeo.ts`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts)

- Contestant videos upload via Vimeo TUS protocol into per-competition folders ([`vimeo.ts L340–375`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L340))
- Folder naming: `{competitionId}-{competitionTitle}` — predictable, never walked at runtime
- Video URLs stored on the talent's Firestore profile (`videoUrls[]`) and read from there — the app never traverses the Vimeo folder tree at page load
- Signed play URLs cached 23 hours server-side ([`vimeo.ts L530`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L530))
- Ambient/background URL prefers 360p → 480p → next available — low bandwidth for loops that don't need quality ([`vimeo.ts L520–523`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L520))
- Vimeo folder cache: 30 minutes in-process ([`vimeo.ts L143`](https://github.com/Delo92/The-Quest/blob/main/server/vimeo.ts#L143))

---

## Summary: The Core Principles

1. **Thumbnail first, video on top.** Never show a blank frame. The thumbnail is the guaranteed state; video is an enhancement layered on top.
2. **Mount late, unmount on exit.** IntersectionObserver gates iframe creation. Toggle `isInView` — never latch it to true — or you accumulate players in RAM across scroll.
3. **Muted everywhere ambient.** Autoplay with audio fails on every mobile browser. Unlock audio only on explicit user gesture via postMessage or iframe remount.
4. **Vimeo iframe for ambient, custom player for full playback.** Never mix the two on the same surface.
5. **Service worker never touches video.** Explicitly bypass all streaming domains. Actively unregister the SW in dev environments — skipping registration alone is not enough.
6. **Mobile is a first-class target.** Safari native HLS, `playsInline`, `loading="eager"` inside 3D transforms, and proportion-relative card offsets are all deliberate decisions, not afterthoughts.
