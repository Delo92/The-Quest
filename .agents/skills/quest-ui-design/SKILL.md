---
name: quest-ui-design
description: Project UI standard for The Quest. Use for every new or changed interface, page, dashboard, form, component, or responsive layout in this project.
---

# The Quest UI design standard

Use this skill together with Replit's built-in `design` and `react-vite` skills. It adapts the open-source TasteSkill framework from `https://github.com/tasteskill/tasteskill` to The Quest instead of replacing Replit's guidance.

## Required process

1. Inspect the current component, its real data and actions, the surrounding routes, and the current rendered UI.
2. Preserve existing behavior and work with the current React, Vite, Tailwind v3, shadcn, Wouter, and Framer Motion stack.
3. Diagnose navigation, hierarchy, density, responsiveness, accessibility, interaction states, and visual consistency before editing.
4. Make targeted, reviewable improvements rather than rewriting working product logic.
5. Verify the result at phone (375–430px), tablet (~768px), and desktop (1024px+) widths.

## TasteSkill principles

- Build deliberate interfaces, not generic AI layouts. Every screen should have clear hierarchy, disciplined spacing, and a strong product-specific identity.
- Use the existing off-black and charcoal palette with The Quest's single orange/amber accent. Avoid purple/blue AI gradients, neon glows, pure black surfaces, and competing accents.
- For dashboard UI, use high-quality sans-serif typography, tabular figures for data, readable labels above controls, and consistent text rhythm.
- Use cards only when containment communicates hierarchy. Prefer spacing, dividers, grouped panels, and clear section boundaries over boxing every element.
- Avoid endless accordion stacks, equal three-card grids, excessive modals, oversized headings, filler copy, and decorative motion that slows task completion.
- Give every interactive control visible hover, focus, active, disabled, loading, success, empty, and error treatment where applicable.
- Animate only transform and opacity. Keep motion short and functional; respect reduced-motion preferences.
- Use CSS Grid for reliable layouts. Avoid hardcoded widths and complex percentage calculations.
- Keep a constrained content width on large screens and a strict single-column fallback below 768px.
- Do not add a dependency without checking `package.json`.
- Do not use emojis in interface copy, markup, or alt text.

## The Quest admin dashboard

- Optimize for frequent operational work: users must always know where they are, how to reach another area, and what actions are available.
- Use persistent top-level navigation on desktop and a compact, touch-friendly navigation control on mobile.
- Group related settings into named destinations rather than one long undifferentiated page.
- Provide search or filtering for large settings collections.
- Keep destructive actions visually distinct and require confirmation.
- Keep save actions close to the fields they affect and make pending/success states obvious.
- Preserve all existing permissions, queries, mutations, test IDs, and API contracts.

## Responsive and accessibility requirements

- Start with a single-column phone layout, then add tablet and desktop complexity.
- Use fluid widths and responsive utilities; never create horizontal page scrolling.
- Keep touch targets comfortably usable and base text readable without zooming.
- Reflow navigation and form controls instead of shrinking them.
- Constrain images and media to their containers.
- Use semantic landmarks, visible keyboard focus, sufficient contrast, descriptive labels, and sensible heading order.
- Do not claim responsiveness until the changed screen has been exercised at phone, tablet, and desktop widths.

## Final check

- Can a first-time admin reach every top-level area quickly?
- Is the current location obvious?
- Are related controls grouped and searchable?
- Are primary and destructive actions distinguishable?
- Does the interface work without horizontal scrolling at all three target widths?
- Did all existing functionality and API behavior remain intact?