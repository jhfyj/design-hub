---
name: motion
description: "Use whenever a design-hub interaction needs animation — enter/exit, drag-to-reorder, layout reflow, or micro-interactions. Documents which library we use, our motion conventions, and where it's already applied so new animations stay consistent."
---

# /motion

design-hub uses **Motion for React** (the library published to npm as `framer-motion`, now branded "Motion" at motion.dev — same engine, `framer-motion` v12+ and `motion/react` are interchangeable import paths). It's already a dependency (`framer-motion@^12.23.22` in `package.json`) — **do not add the separate `motion` package**, that would just duplicate the same engine under a second name.

```tsx
import { motion, AnimatePresence, Reorder } from "framer-motion";
```

## Reference implementation

`client/src/components/TodoWidget.tsx` is the first (and as of this writing, only) place Motion is used in the app. It was built directly against motion.dev's React to-do list example (https://motion.dev/examples/react-todo-list) and demonstrates the four patterns most other interactions will need:

1. **Drag-to-reorder** — `Reorder.Group`/`Reorder.Item` wraps the active task rows; `values` is an array of stable primitive ids (not object references — object identity churns on every state update, which breaks Reorder's tracking).
2. **Enter/exit for list items** — `AnimatePresence` wrapping a `.map()`, each item a `motion.div` with `layout` + `initial`/`animate`/`exit` on `height`/`opacity`, so a row smoothly collapses out when a task completes, gets deleted, or is pruned from Recents instead of just vanishing.
3. **Animated collapsible panel** — the list's expand/collapse animates `height: "auto"` (Motion measures the natural height for you; no manual JS measurement needed) inside `AnimatePresence`.
4. **Small delight touches** — the chevron rotates via `animate={{ rotate: expanded ? 180 : 0 }}` instead of swapping icon components; the checkbox checkmark pops in with a spring; task completion draws an animated strikethrough line (`scaleX: 0 → 1` on an absolutely-positioned bar) rather than an instant CSS `text-decoration`.

## Conventions to match

The codebase already had two easing conventions in plain CSS `transition` strings before Motion arrived — keep using the one that fits the situation rather than inventing a third:

- **Hover/pressed feedback** (background color, box-shadow, small transform): `var(--ease-out)` = `cubic-bezier(0.23, 1, 0.32, 1)`, ~150–160ms. In Motion: `transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}`.
- **Enter/exit / remove-from-layout** (a card shrinking and fading out, a row collapsing): `cubic-bezier(0.4, 0, 0.2, 1)`, ~220–380ms. This is what `TodoWidget.tsx`'s `EASE_OUT` constant is (matches `JobCard`/`TldrCard`'s existing removal animation in `Home.tsx`).
- **Springy pops** (a checkmark or badge appearing): a real spring, not a duration curve — `transition={{ type: "spring", stiffness: 500, damping: 20 }}` is the value already used for the to-do checkbox.

Don't reach for Motion to replace every `onMouseEnter`/`onMouseLeave` inline-style hover in the app — those are cheap and working. Motion earns its cost where CSS can't do the job cleanly: exit animations for unmounting elements, drag gestures, `layout`-based reflow when siblings resize, and `height: "auto"` transitions.

## Candidate interactions elsewhere in the app

Not done yet, don't do them unless asked, but these are the next-best candidates if the user asks to extend motion to "other interactions":

- **`Home.tsx` `JobCard`** — the apply → "Applied" → shrink-out sequence is currently hand-rolled with `useState`/`useEffect`/`setTimeout` (see the `applied`/`appliedPop`/`removing` state machine). This is exactly what `AnimatePresence` + `motion.div` variants replace more simply.
- **`Home.tsx` `TldrCard`** — same shrink-fade-on-mark-read pattern as `JobCard`.
- **`NavRail.tsx`** — the collapsed↔expanded width transition and per-item highlight background are plain CSS transitions; could become a `layout` animation on the highlight pill (`layoutId="nav-highlight"` shared across items) for a smoother slide-between-items effect instead of independent fades.
- **`JobWatchList.tsx` tag chips** — adding/removing a chip is instant; `AnimatePresence` would let chips animate in/out.
- **Design Inspos masonry grid (`Home.tsx`)** — the refresh shuffle currently swaps the array with no transition; `layout` on each tile would animate the reflow.

## Gotchas hit while building the to-do list

- `Reorder.Item`'s `value` must be a stable primitive (we use `task.id`, a `number`) — passing the task object itself breaks reordering because a fresh object is created on every store update.
- Animating `height: "auto"` works out of the box in Motion (it measures internally) — no need for the manual "set max-height then transition" CSS hack used elsewhere in the codebase for things that don't use Motion.
- Nesting interactive `<button>`s inside a draggable `Reorder.Item` works fine — Motion's drag gesture requires a movement threshold before it engages, so ordinary clicks on nested buttons still fire normally.
