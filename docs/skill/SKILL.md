---
name: design-hub
description: Design system, screen conventions, and architecture reference for the Design Hub desktop app (Electron + Node.js + Claude API). Use when designing new screens, building UI components, implementing interactions, or adding features to the Design Hub app. Contains the full Figma-sourced design language, color tokens, typography, component patterns, navigation structure, and integration architecture so every new screen is visually and functionally consistent with the existing hi-fi.
---

# Design Hub — Design & Architecture Skill

This skill is the single source of truth for the Design Hub desktop app. Read it before designing any new screen, component, or feature. Reference the exported Figma frames in `references/` for visual confirmation.

---

## App Overview

Design Hub is a single-user personal Electron desktop app (macOS/Windows/Linux). It is a creative productivity environment for a designer, combining a freeform brainstorming canvas, an AI co-creation agent, a curated home dashboard, and integrated data feeds. The backend is Node.js/Express. The AI agent uses the Claude API (placeholder key `CLAUDE_API_KEY`).

### Primary Routes

| Route | Frame Reference | Status |
|---|---|---|
| Home / Dashboard | `home_macbook_2.png` | Hi-fi complete |
| Project Canvas — Empty | `macbook_3.png` | Hi-fi complete |
| Project Canvas — Editing | `macbook_4.png` | Hi-fi complete |
| Project Canvas — Populated | `macbook_5.png` | Hi-fi complete |
| Project Canvas — Media Search | `macbook_6.png` | Hi-fi complete |
| Project Canvas — Media Card | `macbook_7.png` | Hi-fi complete |
| Project Canvas — Context Menu | `macbook_8.png` | Hi-fi complete |
| Project Canvas — Export Modal | `macbook_9.png` | Hi-fi complete |
| Job Watch List (config panel) | `frame_159.png` | Hi-fi complete |
| Notifications | Not yet designed | Planned |
| Saved | Not yet designed | Planned |

---

## Design Tokens

### Color Palette

All values are hex. Use CSS custom properties with these exact names.

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#232323` | App background (canvas, page root) |
| `--color-surface` | `#2A2A2A` | Cards, panels, floating elements |
| `--color-surface-raised` | `#313131` | Elevated cards, modals |
| `--color-surface-input` | `#3B3B3B` | Input fields, toolbar slots |
| `--color-border` | `#484848` | Subtle borders, dividers |
| `--color-accent` | `#E1FF00` | Primary accent — lime yellow. Used for: active nav icon background, CTA buttons, Agent Mode button, badges (NEW!, URGENT), ADD NEW dashed border, tag chips (+), recommendation highlights |
| `--color-accent-text` | `#E1FF00` | Text on dark when accent-coloured (e.g. nav label when active) |
| `--color-text-primary` | `#FBFBFB` | Headings, primary body text |
| `--color-text-secondary` | `#E1E1E1` | Secondary labels, card metadata |
| `--color-text-muted` | `#888888` | Placeholders, hints, timestamps |
| `--color-text-disabled` | `#515151` | Disabled states |
| `--color-agent` | `#FF00E9` | Magenta — agent suggestions, AI annotations on canvas |
| `--color-graph-line` | `#1D3AFB` | Blue — connection lines between canvas nodes |
| `--color-graph-suggestion` | `#E1FF00` | Dashed yellow — agent-suggested connections |
| `--color-status-applied` | `#E1FF00` | Job card "Applied" badge |
| `--color-status-urgent` | `#FF3D3D` | Job card "URGENT" badge |
| `--color-white` | `#FFFFFF` | Icon fills, pure white text on dark |

### Typography

Three typefaces are used. Never mix them arbitrarily — each has a defined role.

| Family | Role | Notes |
|---|---|---|
| **Figtree** | All UI text — navigation, cards, labels, buttons, body | Primary UI font. Variable weight from 300 to 700. |
| **Mynerve** | Freeform canvas handwriting-style nodes | Used for brainstorming text nodes on the project canvas to evoke a hand-drawn feel. |
| **Fira Mono** | Monospace — code nodes, keyboard shortcut hints, technical labels | Used in the canvas toolbar hints and code-type canvas nodes. |

#### Type Scale (Figtree)

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-hero` | 96px | 400 | Home screen greeting (Welcome back, Jen) |
| `--text-display` | 40px | 600 | Section headings, modal titles |
| `--text-heading` | 36px | 600 | Card titles, page section headers |
| `--text-subheading` | 28px | 600 | Sub-section labels |
| `--text-body-lg` | 24px | 400–500 | Primary body, article summaries |
| `--text-body` | 20px | 400–600 | Standard UI labels, nav items, card content |
| `--text-body-sm` | 18px | 400 | Secondary card content |
| `--text-caption` | 12px | 400 | Timestamps, metadata, source URLs |
| `--text-micro` | 11px | 400 | Chip labels, badge text, dense metadata |

### Spacing System

Base unit is **4px**. All spacing values are multiples of 4.

| Token | Value | Common use |
|---|---|---|
| `--space-1` | 4px | Icon padding, micro gaps |
| `--space-2` | 8px | Tight padding in chips, small gaps |
| `--space-3` | 12px | Card inner padding (compact) |
| `--space-4` | 16px | Standard horizontal padding |
| `--space-5` | 20px | Section padding |
| `--space-6` | 24px | Card padding, section gaps |
| `--space-7` | 28px | Large gaps between sections |
| `--space-8` | 32px+ | Page-level margins |

The most frequent gap in the design is **10px** (used for flex/grid gaps inside cards and toolbars). Standard card padding is **10–16px** horizontal, **10–12px** vertical.

### Border Radius

Cards and panels use **12–16px** radius. Buttons and chips use **8px**. Pills and tags use **999px** (fully rounded). The canvas grid background uses no radius.

---

## Navigation Rail (Left Sidebar)

The NavRail is a **floating pill** — not flush to the left wall. It has a fixed `left: 12px` offset, is vertically centered (`top: 50%; transform: translateY(-50%)`), and has a drop shadow. It is **identical on every screen** — the canvas does not add extra tool icons to the rail.

### Dimensions

| State | Width | Border-radius |
|---|---|---|
| Collapsed (default) | 52px | 16px |
| Hover-expanded | 200px | 16px |

The radius stays at **16px** in both states — only the width animates (`260ms cubic-bezier(0.23,1,0.32,1)`). Labels animate in/out via `max-width` + `opacity` transition so they never snap.

### Rail items (top to bottom — same on every screen)

1. **New Project button** — Lime circle (`--color-accent`) with `+` icon. Always at top. Label `New Project` visible when expanded.
2. **Notifications** — Bell icon.
3. **Home** — House icon.
4. **Projects / Folder** — Folder icon.
5. **Saved / Bookmark** — Bookmark icon.
6. *(Divider line)*
7. **Quick-access project slots** — Numbered slots (1, 2, 3, 4) showing recent projects. Number + vertical divider + project name when expanded.
8. *(Flex spacer — pushes Settings to the very bottom)*
9. **Settings** — Gear icon at bottom. Significant visual gap between slots and Settings.

### Active state

**No yellow on active nav items.** Active state = light grey background highlight (`rgba(255,255,255,0.10)`) with white icon — identical to the project slot active style. The New Project button background is always `--color-accent`. All other icon fills default to `--color-text-secondary` (#E1E1E1) regardless of active/inactive.

### Highlight geometry

- **Collapsed**: 36×36px square highlight, `border-radius: 6px`, centered within the 52px pill. Never touches left/right edge.
- **Expanded**: Full-width highlight with 6px horizontal inset on each side, `border-radius: 6px`. Never touches left/right edge.

### Icon library

All icons use **IBM Carbon Icons React** (`@carbon/icons-react`). Never use Lucide or other icon libraries for NavRail or section headers.

---

## Home Screen

Reference: `home_macbook_2.png`

The home screen is a vertically scrollable single-column layout with a dark dot-grid background. It has three distinct zones.

### Hero Zone (top)

- Floating inspiration cards appear scattered around the hero area (positioned absolutely). All four cards are **draggable** and clicking them opens their source URL. Cards must not overlap the greeting title.
- Center: time and location line in `--text-caption` Fira Mono — e.g. `5:00:00 pm | Santa Monica`.
- Large greeting in `--text-hero` Figtree 400: `Welcome back, [name]`. Must fit on a single line.
- Subtitle in `--text-body-lg` muted: `What are we working on today?`.
- Agent input bar centered below. Typing surfaces **phrase-completion suggestions** in a dropdown that floats above all sections (z-index 9999). Suggestions are filtered by prefix-first then contains match against a suggestion bank. Clicking a suggestion fills the input.
- The hero zone uses the dot-grid canvas texture as its background.

### Content Sections

Each section follows this pattern: section header row (icon + label in `--text-heading` + optional action button right-aligned), followed by its content grid.

#### Job Board

- Two-column grid of job cards.
- Each card: company logo (use `cdn.simpleicons.org` SVG logos), company name in bold caps, role title, due date bottom-left, posted time bottom-right.
- **Badge rules** (most jobs have no badge):
  - `NEW!` (lime) — only for jobs not seen since the last session (posted < 8h ago).
  - `URGENT` (red) — only when deadline is less than 24 hours away.
  - `RECOMMENDED` (lime, dashed lime border on card) — matched by watch-list criteria.
  - No badge = default for most jobs.
  - `Applied` badge is **not shown** — applied jobs are removed from the board with a shrink-fade animation.
- **Hover behaviour**: Card background darkens over 350ms. The badge is replaced by an `Apply` button (top-right position) on hover. Date and posted time remain visible throughout hover.
- Clicking the card opens the job post URL. Clicking Apply triggers a shrink-scale-to-zero animation then removes the card.
- Section header right action: `watchlist ≡` button.

#### TLDR

- Two-column grid of article summary cards.
- Each card: article title (always white underline, turns lime on hover, clicking opens source URL), short blurb, `What you need to know` section, generous spacing gap, `What it means to you` section. **No divider lines between sections** — use spacing only.
- `Read` button: checkmark icon appears **after** the text (not before). Arrow and text order: `Read ✓`.
- Section header right action: `view archive` button.
- Expand/collapse affordance below the grid.

#### Design Inspos

- Masonry-style grid (variable row heights, 3+ columns).
- Cards are image tiles with a `+` add button on hover. The `+` must be perfectly centered inside the button.
- Section header right action: `Refresh` button with a Renew icon to its right. Clicking Refresh genuinely reshuffles the grid (does not just re-render the same order).
- Sources: Pinterest, Are.na, Mobbin, component websites.

---

## Project Canvas

References: `macbook_3.png` through `macbook_9.png`

The canvas is a **freeform infinite pan-and-zoom space** with a dark background and a subtle crosshair/plus-sign dot grid texture in a slightly lighter tone.

### Canvas Chrome

- **Top-left**: Project title dropdown (Figtree 600, 20px, muted). Clicking opens rename/version management.
- **Top-right**: Zoom/scroll hint text in Fira Mono (muted), `Organize` button (dark surface, light text), `Export` button (light surface `#D3D4D9`, dark text, bold).
- **Bottom center**: Floating toolbar (see below).

### Bottom Floating Toolbar

The toolbar is a dark pill/rounded-rectangle floating above the canvas. It contains icon buttons for insertion modes and a search field. The toolbar evolves based on context:

**Default state** (macbook_3): select, image, duplicate/card, text, link, graph/connection tool, large search input with magnifier.

**Editing state** (macbook_4): select, image, text, link, code `</>`, draw/pen, agent (sparkle icon), duplicate/card, search. Agent Mode CTA appears at far right as a lime-highlighted button with sparkle icon and `Agent Mode` label.

**Active agent mode** (macbook_5, macbook_7): Agent Mode button remains highlighted. Agent suggestions appear on canvas as magenta text annotations and dashed yellow connection lines.

### Canvas Nodes

Nodes are the building blocks placed on the canvas. Each node type has a defined visual treatment:

| Node Type | Visual |
|---|---|
| Text node | Handwritten-style Mynerve font, no background, direct on canvas |
| Link/URL card | Rounded card with site favicon, title, truncated URL in caption style |
| Image card | Rounded card with image preview, title, source URL row |
| Video clip card | Rounded card with scrub control (green progress bar, pill handle), time range, lime FINISH button, preview image below |
| Code node | Fira Mono text, possibly with syntax highlight |
| Ellipse/shape node | Outlined ellipse, no fill, with text inside |

### Connection Lines

- **User-drawn connections**: Solid blue lines (`#1D3AFB`), thin stroke.
- **Agent suggestions**: Dashed yellow lines (`#E1FF00`), thin stroke.
- Connections terminate at node edges with no arrowhead (or a minimal dot).

### Inline Node Toolbar (on selection)

When a node is selected, a small floating toolbar appears above it: color dot (node color picker), size selector dropdown, link icon, Bold, Italic, sparkle/AI action.

### Semantic Marker Menu

A radial/dropdown menu for tagging nodes with semantic meaning: Circle (C), Star (S), Exclamation (E), Question (Q).

### Context Radial Menu

Right-click or long-press on canvas opens a radial quick-add menu with: image, code `</>`, select/move, link. A small lime label shows the node name being created.

### Media Search Overlay

Triggered from the search tool in the bottom toolbar. A large dark floating panel opens above the toolbar, centered. Contains: search input + `Detailed Search` button, category tabs (`Image`, `UI`, `UX`, `Text`, `Video`, `Sound`, `Animation`), masonry results grid.

### Export Modal

Centered modal with blurred background. Contains: title, dimensions display, image preview with blue crop/resize handles, file-size slider, width/height inputs, export format dropdown, `Copy` and `Download` buttons.

---

## Job Watch List Panel

Reference: `frame_159.png`

A full-panel configuration screen accessed from the Job Board section header.

### Layout (top to bottom)

1. Page title `JOB WATCH LIST` + subtitle.
2. **Company section**: Three-column grid of company cards. First card is always `+ ADD NEW` with dashed lime border. Cards have **no stroke/border** — use surface fill color only.
3. **Search field** (`Search companies...`) — bottom-aligned to the company section, placed directly below the company grid so it is visually adjacent to the cards it filters.
4. **Divider line** — separates the company section from the tags section below.
5. **Tags section**: `Must Include` and `Relevant` pill chip groups with `×` remove and lime `+` add buttons.

---

## Integration Architecture

### Integrated at Launch

| Source | Purpose | Integration method |
|---|---|---|
| Pinterest | Design Inspos board, canvas media search | Pinterest API / scraping |
| LinkedIn | TLDR news feed | LinkedIn API |
| Mobbin | Design Inspos board, canvas UI/UX search | Mobbin API / scraping |
| Web search | Canvas search, general agent context | Web search MCP |

### Planned / Not Yet Integrated

| Source | Intended purpose |
|---|---|
| Are.na | Design Inspos board |
| Safari / web browsing | Canvas in-app browser, general research |
| Company job boards | Job Board feed (direct scraping per watched company) |
| Newsletters | TLDR feed (email parsing or RSS) |
| Component websites | Design Inspos board |
| Sound sources | Canvas sound node insertion |
| Animation sources | Canvas animation node insertion |

### Agent (Claude API)

- Model: Claude (placeholder — use `CLAUDE_API_KEY` env var, configurable in settings).
- Agent mode is toggled from the canvas bottom toolbar.
- In agent mode, the agent co-creates on the canvas: suggests similar, opposite, or unexpected words/phrases/media/links/code/sounds/animations as new nodes with dashed yellow connection lines.
- On the home screen, the agent passively surfaces media, quotes, book/movie recommendations in the hero zone.
- Agent suggestions use `--color-agent` (#FF00E9) for text annotations and `--color-graph-suggestion` (#E1FF00) for dashed connection lines.

---

## Component Conventions

When building new screens, follow these rules:

1. **Dark-first**: Every surface defaults to a dark color from the palette. Never use white or light backgrounds as the base.
2. **Three-level surface hierarchy**: Page background (`--color-bg` #232323) → section board (`--color-surface` #2A2A2A) → card (`--color-surface-raised` #313131). Each content section (Job Board, TLDR, Design Inspos) sits on its own `--color-surface` board on top of the dot-grid page background.
3. **No card outlines**: Cards use their natural fill color only. Never add a border or stroke to a card unless it is the `+ ADD NEW` dashed-lime special case.
4. **Lime accent is intentional**: Use `--color-accent` only for primary actions, active states, and agent-related affordances. Do not use it decoratively.
5. **Magenta is agent-only**: `--color-agent` (#FF00E9) is exclusively for AI/agent-generated content.
6. **Blue is graph-only**: `#1D3AFB` is exclusively for canvas connection lines.
7. **Figtree everywhere except canvas nodes**: Canvas brainstorming text uses Mynerve. Code and technical hints use Fira Mono. All other UI uses Figtree.
8. **Cards use subtle elevation**: Distinguish surface levels with fill color, not drop shadows.
9. **Rounded corners**: 12–16px for cards/panels, 8px for buttons/chips, 999px for pills/tags.
10. **Grid dot texture**: The canvas background uses a subtle crosshair/plus grid. The home screen uses a similar dot grid. This texture is a defining visual signature of the app.
11. **Icon library**: All icons use **IBM Carbon Icons React** (`@carbon/icons-react`). Section header icons are always white regardless of active state. Never use Lucide or other icon libraries.
12. **Masonry for inspo content**: Any inspirational image grid (home inspo board, canvas media search) uses masonry layout with variable tile heights.
13. **Status badges**: Always use the defined color semantics — lime for new/recommended, red for urgent, no other status colors.

---

## File & Screen Naming Convention

- Figma frames: `MacBook Pro 16" — [ScreenName]` or `[ComponentName] — [State]`
- React components: `PascalCase` matching the screen name (e.g. `HomeScreen`, `ProjectCanvas`, `JobWatchList`)
- Route paths: `kebab-case` (e.g. `/home`, `/projects/:id`, `/saved`, `/notifications`)

---

## How to Add a New Screen

1. Read this SKILL.md in full.
2. View the relevant reference frames in `references/` for visual context.
3. Identify which zone the new screen belongs to (home, canvas, config panel, modal).
4. Apply the correct color tokens, typography scale, and component patterns from this document.
5. Use the left rail in its correct state (home state vs. canvas state).
6. After implementing, update the **Primary Routes** table at the top of this file to mark the new screen as complete and add its reference frame filename.
7. Export the new Figma frame and add it to `references/` using the naming convention above.
