---
name: Lazy iframe mount/unmount pattern
description: How IntersectionObserver should be used for iframes — the memory leak trap and the correct toggle pattern.
---

## Rule
IntersectionObserver for iframes must TOGGLE visibility, not latch it. `setVisible(entry.isIntersecting)` — not `if (entry.isIntersecting) setVisible(true)`.

**Why:** The latch pattern (`if intersecting → set true, then disconnect`) loads the iframe once and never unloads it. On a 12-contestant page a user scrolling to the bottom loads all 12 Vimeo players simultaneously into mobile RAM. The toggle pattern keeps only the 3–4 currently-visible iframes in the DOM; scrolled-away ones unmount and release memory.

**How to apply:** In any LazyVimeoIframe or equivalent component, keep the observer connected (do NOT call `observer.disconnect()` inside the callback). Let the observer run for the lifetime of the component. The cleanup `return () => observer.disconnect()` handles teardown on unmount.

```ts
const observer = new IntersectionObserver(
  ([entry]) => { setVisible(entry.isIntersecting); }, // toggle, not latch
  { rootMargin: "200px" }
);
observer.observe(el);
return () => observer.disconnect(); // only disconnect on component unmount
```
