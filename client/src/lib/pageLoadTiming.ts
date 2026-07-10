/**
 * Home-page load choreography.
 * Home.tsx, NavRail.tsx, and TodoWidget.tsx render as independent siblings
 * that all mount at once — this file is the one shared timeline so their
 * entrance delays stay in sync without prop-drilling between them.
 * Ease/duration values follow .claude/skills/motion/SKILL.md conventions.
 */

// Enter/exit curve — matches EASE_OUT already used in Home.tsx/TodoWidget.tsx.
export const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// 1. Header — greeting label, then the title types in, then the subtitle.
export const T_GREETING = 0;
export const T_TITLE = 0.15;
export const T_SUBTITLE = 0.85;

// 1b. Header — the four hero cards pop in one after another.
export const T_HERO_CARDS = 0.95;
export const HERO_CARD_STAGGER = 0.1;

// 2. Agent search bar — send button first, then the pill expands to full width.
// Starts right as the header text (title + subtitle) finishes, independent
// of the hero cards still popping in.
export const T_SEARCH_BAR = 1.1;

// 3. Content sections (Job Board, TLDR, Design Inspos) pop in one after another.
export const T_SECTIONS = 1.9;
export const SECTION_STAGGER = 0.12;

// 4. Left NavRail slides/expands in from the left edge.
export const T_NAVRAIL = 2.35;

// 5. To-do widget expands from a compact state, then the "+" button pops in.
export const T_TODO = 2.65;
export const T_TODO_PLUS = 2.95;

// Module state survives client-side (wouter) route changes — it only resets
// on an actual browser reload, since that re-evaluates the module fresh.
// Home.tsx consumes this once per mount and threads the result down to
// NavRail/TodoWidget as a prop, so the intro plays on a real page load but
// not when the user navigates away and back to Home in the same session.
let introPlayed = false;

export function consumeIntroPlay(): boolean {
  if (introPlayed) return false;
  introPlayed = true;
  return true;
}
