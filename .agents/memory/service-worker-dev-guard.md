---
name: Service worker dev guard
description: SW must be actively unregistered in dev/Replit environments, not just skipped — a previously installed SW will keep claiming pages and dropping Vite HMR connections.
---

## Rule
The service worker (`client/public/sw.js`) must NOT register on `localhost` or `*.replit.dev`. More importantly, any previously installed SW must be **actively unregistered** via `navigator.serviceWorker.getRegistrations()` on those hostnames — simply skipping `register()` is not enough because an existing SW continues claiming pages.

**Why:** `self.clients.claim()` in the SW activate handler forcibly seizes control of all open pages under its scope. In development this drops Vite's HMR WebSocket, causing a visible "connecting…" flash on every navigation. The unregister call clears any SW that was installed before the guard was added.

**How to apply:** The guard lives in `client/index.html` in the inline script at the bottom of `<body>`. It checks `isDev = hostname === "localhost" || hostname.includes(".replit.dev")`. In dev it calls `getRegistrations().then(regs => regs.forEach(r => r.unregister()))`. In prod it registers normally after `window.load`. Do not move registration to `main.tsx` — the inline script must run before React boots so it can unregister promptly.
