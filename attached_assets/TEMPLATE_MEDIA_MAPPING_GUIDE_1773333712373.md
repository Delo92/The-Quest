# Template Media Mapping & Social Embed Guide

## Overview

This system allows you to map client brand assets (images, videos, and social media embeds) to specific image slots in an HTML template. When a client's branded preview is generated, every mapped slot is automatically replaced with the client's content — whether that's a photo, a video file, a YouTube link, a Vimeo link, a Facebook post, or an Instagram post.

---

## Available Slot Names

These are the named slots the system recognizes. Each one maps to a specific role in a template:

| Slot Name | Purpose |
|---|---|
| `logo` | Business logo image |
| `favicon` | Browser tab icon |
| `hero` | Main hero / banner background image or video |
| `about` | About section image |
| `banner` | Secondary banner image |
| `team` | Team photo |
| `product-1` | Product or service image 1 |
| `product-2` | Product or service image 2 |
| `product-3` | Product or service image 3 |
| `gallery-1` through `gallery-7` | Gallery / portfolio images |

---

## How Media Mapping Works

### Step 1 — Upload the Template ZIP

Upload the HTML template as a ZIP file through the admin panel. The system will:

1. Extract all files and store them
2. Automatically scan the HTML and CSS for image references
3. Auto-detect which template images match which slot names based on filename patterns
4. Save the mapping as a JSON object called `mediaMapping`

### Step 2 — The Media Mapping JSON

The `mediaMapping` is stored on the template record. It is a JSON object where:
- **Key** = the image filename as it appears in the template HTML/CSS (relative path)
- **Value** = the slot name it should be replaced with

**Example:**
```json
{
  "images/hero-bg.jpg": "hero",
  "images/logo.png": "logo",
  "images/about-photo.jpg": "about",
  "img/gallery1.jpg": "gallery-1",
  "img/gallery2.jpg": "gallery-2",
  "assets/product1.jpg": "product-1"
}
```

When the branded preview is generated, the system finds every `<img src="images/hero-bg.jpg">` in the HTML and replaces `images/hero-bg.jpg` with whatever the client put in their `hero` slot.

### Step 3 — Explicit vs. Fuzzy Matching

The system uses two matching strategies in order:

1. **Explicit mapping** (preferred) — Uses the `mediaMapping` JSON described above. Exact filename match → slot name.
2. **Fuzzy fallback** — If no explicit mapping exists, the system guesses based on the filename itself. Files with `hero`, `logo`, `gallery`, `about`, `banner`, etc. in their name are matched to the corresponding slot automatically.

**Best practice:** Always set an explicit `mediaMapping` for reliable results. The fuzzy fallback is only a safety net.

---

## How to Set the Media Mapping in the Admin

### Auto-Detection on Upload

When you upload a template ZIP, the system automatically scans the files and builds a best-guess `mediaMapping`. You can see how many mappings were detected in the success toast after upload.

### Manual Edit

In the admin template list, click the **Edit** (pencil) icon on a template. In the edit dialog, there is a **Media Mapping** JSON field. You can read and edit the mapping directly there.

### Rescan

Click the **Rescan** (refresh icon) button on any template that already has files uploaded. This re-runs auto-detection on the existing files and regenerates the mapping.

---

## Supported Media Types Per Slot

A client can put any of the following into any slot. The system automatically detects the type and renders it correctly.

### 1. Image (default)
Any direct image URL (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`, `.avif`).

**Renders as:** `<img src="..." />`

---

### 2. Direct Video File
A direct link to a video file ending in `.mp4`, `.webm`, or `.mov`.

**Renders as:**
```html
<video src="..." muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover;"></video>
```
Autoplays silently in the background. Best used for hero slots.

---

### 3. YouTube Video
Any YouTube URL — standard (`youtube.com/watch?v=...`) or short (`youtu.be/...`).

**Renders as:** An autoplay, muted, looping iframe embed with no controls and no branding.
```html
<iframe src="https://www.youtube.com/embed/VIDEO_ID?autoplay=1&mute=1&loop=1&playlist=VIDEO_ID&controls=0&showinfo=0&modestbranding=1" ...></iframe>
```

---

### 4. Vimeo Video
Any Vimeo URL (`vimeo.com/VIDEO_ID` or `player.vimeo.com/video/VIDEO_ID`).

**Renders as:** An autoplay, muted, looping background iframe.
```html
<iframe src="https://player.vimeo.com/video/VIDEO_ID?autoplay=1&muted=1&loop=1&background=1" ...></iframe>
```

---

### 5. Facebook Post or Video
Any Facebook URL from `facebook.com`, `fb.com`, or `fb.watch`.

**Renders as:**
- If the URL contains `/videos/`, `/watch`, `fb.watch`, or `/reel` → `fb-video` embed
- Otherwise → `fb-post` embed

```html
<!-- Video -->
<div class="fb-video"
  data-href="https://www.facebook.com/page/videos/123"
  data-width="auto"
  data-show-text="false"
  data-autoplay="true"
  data-mute="true">
</div>

<!-- Post -->
<div class="fb-post"
  data-href="https://www.facebook.com/page/posts/123"
  data-width="auto"
  data-show-text="true">
</div>
```

The Facebook JavaScript SDK (`connect.facebook.net/en_US/sdk.js`) is automatically injected into the page when any Facebook embed is detected.

**Note:** Autoplay (`data-autoplay="true"`) is requested but Facebook's SDK may or may not honor it depending on browser policies. The embed will always be clickable to play manually.

---

### 6. Instagram Post, Reel, or Video
Any Instagram URL matching `instagram.com/p/...`, `instagram.com/reel/...`, or `instagram.com/tv/...`.

**Renders as:**
```html
<blockquote class="instagram-media"
  data-instgrm-permalink="https://www.instagram.com/p/POST_ID/"
  data-instgrm-version="14"
  data-instgrm-captioned>
  <a href="...">View on Instagram</a>
</blockquote>
```

Instagram's embed script (`//www.instagram.com/embed.js`) is automatically injected. Instagram embeds are always click-to-play — autoplay is not supported by Instagram's platform.

---

## URL Detection Rules (Quick Reference)

| URL Pattern | Detected As |
|---|---|
| ends in `.mp4`, `.webm`, `.mov` | Direct video (autoplay) |
| `vimeo.com/...` or `player.vimeo.com/...` | Vimeo (autoplay) |
| `youtube.com/watch?v=...` or `youtu.be/...` | YouTube (autoplay) |
| `facebook.com/...`, `fb.com/...`, `fb.watch/...` | Facebook embed |
| `instagram.com/p/...`, `instagram.com/reel/...`, `instagram.com/tv/...` | Instagram embed |
| anything else | Static image |

---

## Setting Up a New Template — Checklist

1. **Upload the template ZIP** via admin → Web Design Showcase → Upload template zip
2. **Check the auto-detected mapping** — the success message shows how many images were mapped
3. **Open the Edit dialog** and review the Media Mapping JSON field
4. **Correct any wrong mappings** — if `images/header.jpg` was mapped to `banner` but it should be `hero`, fix it in the JSON
5. **Add any missed files** — if an image in the template wasn't auto-detected, add it manually
6. **Save** — changes take effect immediately on all branded previews using this template

---

## Example: Music Landing Template

The Music Landing template uses these mappings:

```json
{
  "images/hero-bg.jpg": "hero",
  "images/logo.png": "logo",
  "images/album-cover.jpg": "product-1",
  "images/gallery-1.jpg": "gallery-1",
  "images/gallery-2.jpg": "gallery-2",
  "images/gallery-3.jpg": "gallery-3"
}
```

A client who puts a YouTube concert video URL into their `hero` slot will see that video autoplaying as the full-page background when their branded preview loads. A client who puts a Facebook post URL into `gallery-1` will see that embedded post in the gallery section.

---

## How Clients Add Media to Slots

In the client portal → **Brand Kit** → **Brand Gallery** tab:

- Each slot shows a placeholder with an **Upload** button (for image/video files) and an **Embed** button (for URLs)
- Clicking **Embed** opens a dialog where the client pastes any supported URL (YouTube, Vimeo, Facebook, Instagram, or direct file URL)
- The system validates and stores it
- The branded preview immediately reflects the change

---

## Admin Override

Admins can set or override any client's slot content from:

**Admin Panel → Clients → [Client Name] → Brand Kit → [Kit Name]**

Each slot has the same Upload and Embed controls as the client portal, giving you full control to set media on behalf of a client.
