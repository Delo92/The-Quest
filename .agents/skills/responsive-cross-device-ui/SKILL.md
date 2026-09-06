---
name: responsive-cross-device-ui
description: Use when building or changing any web UI in The Quest so layouts work on phone, tablet, and desktop rather than only the preview width.
---

# Responsive cross-device UI

- Design mobile-first: begin with a single-column small-screen layout and add complexity at larger breakpoints.
- Use fluid, relative units and Tailwind responsive utilities instead of fixed widths that overflow.
- Avoid horizontal page scrolling.
- Keep buttons, links, and controls touch-friendly and readable; never rely on hover for essential actions.
- Cover phone (~375–430px), tablet (~768px), and desktop (1024px+) breakpoints.
- Reflow navigation and content rather than clipping or shrinking it.
- Constrain images and media to their containers.
- Preserve visible focus states, readable text, and sufficient contrast.
- Verify the changed screens at phone, tablet, and desktop widths before completion.