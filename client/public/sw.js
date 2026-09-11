// Service Worker — app shell cache for The Quest
// Cache static assets on install; serve from cache, revalidate in background.

const CACHE_NAME = "tq-shell-v1";

// These are Vite-generated assets — cache them by extension pattern at runtime.
const NEVER_CACHE = [
  "/api/",
  "player.vimeo.com",
  "vimeocdn.com",
  "akamaized.net",
  "firebasestorage",
  "googleapis.com",
  "googletagmanager",
  "fonts.googleapis",
];

function shouldCache(url) {
  const u = new URL(url);
  // Only cache same-origin requests
  if (u.origin !== self.location.origin) return false;
  // Never cache API calls or third-party media
  for (const pattern of NEVER_CACHE) {
    if (url.includes(pattern)) return false;
  }
  // Cache JS, CSS, fonts, images, wasm
  return /\.(js|css|woff2?|ttf|png|jpg|jpeg|webp|svg|ico|wasm)(\?|$)/.test(u.pathname);
}

// On install: pre-cache the app shell entry point.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/thequest/", "/"])
        .catch(() => {}) // don't block install if shell fetch fails
    )
  );
  self.skipWaiting();
});

// On activate: delete old cache versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate for cacheable assets; network-only for everything else.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  if (!shouldCache(url)) {
    // Network-only — don't intercept
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached); // fall back to cache on network failure

      // Serve cached immediately; update in background
      return cached || networkFetch;
    })
  );
});
