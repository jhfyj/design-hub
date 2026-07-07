import { useCallback, useEffect, useState } from "react";

export interface TldrArticle {
  id: number;
  title: string;
  // Optional since a TLDR story's blurb can come back empty if the digest
  // page's markup didn't match the expected shape — never fabricated.
  blurb?: string;
  need?: string;
  means?: string;
  source: string;
  url: string;
  publishedAt: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

// Mock feed spread across today / yesterday / earlier so the Archive page's
// Today / Yesterday / All past articles grouping has something in each bucket.
export const TLDR_ARTICLES: TldrArticle[] = [
  { id: 1, title: "Apple Announces Redesigned System Fonts for visionOS 3", blurb: "Apple's latest spatial computing update ships with a new variable font system optimised for depth and legibility at distance.", need: "Apple is pushing spatial typography as a new design discipline — expect client briefs around visionOS within 6 months.", means: "Start learning visionOS layout constraints now. The early movers will own this niche.", source: "Design Milk", url: "https://designmilk.com", publishedAt: NOW - 2 * HOUR },
  { id: 2, title: "Figma Launches AI-Powered Component Suggestions in Dev Mode", blurb: "Dev Mode now surfaces AI-generated component alternatives and usage examples inline with inspect panels.", need: "Figma is tightening the design-to-dev handoff loop with AI, reducing back-and-forth on component selection.", means: "Update your component documentation — AI will surface it to devs automatically.", source: "Figma Blog", url: "https://figma.com/blog", publishedAt: NOW - 5 * HOUR },
  { id: 3, title: "Linear Ships a New Motion Language Across the Whole App", blurb: "Every transition in Linear now follows a single shared easing curve and duration scale, documented in a public motion spec.", need: "Motion consistency is becoming a competitive differentiator for productivity tools.", means: "Audit your own product's transitions against a single easing/duration scale.", source: "Linear Blog", url: "https://linear.app/blog", publishedAt: NOW - 9 * HOUR },
  { id: 4, title: "Vercel Open-Sources Its Internal Icon Set", blurb: "The 400-icon set used across Vercel's dashboard is now free to use under MIT license.", need: "Another high-quality icon set enters the free tier, raising the bar for what 'default' icons look like.", means: "Consider it for internal tools where a licensed set like Carbon isn't a fit.", source: "Vercel Blog", url: "https://vercel.com/blog", publishedAt: NOW - 13 * HOUR },
  { id: 5, title: "Notion Redesigns Its Mobile Block Editor", blurb: "Long-press interactions replace the old drag handles, cutting block-reordering taps by half in usability testing.", need: "Mobile-first block editing patterns are converging around long-press + contextual menus.", means: "Revisit any drag-handle-based mobile editor you own — long-press may test better.", source: "Notion Blog", url: "https://notion.so/blog", publishedAt: NOW - DAY - 3 * HOUR },
  { id: 6, title: "Stripe's New Docs Site Uses On-Page AI Summaries", blurb: "Every API reference page now has a collapsible AI-generated summary above the fold.", need: "Docs sites are starting to treat AI summarization as a first-class content format, not a chatbot bolt-on.", means: "Prototype an AI summary block for your own longest docs pages.", source: "Stripe Blog", url: "https://stripe.com/blog", publishedAt: NOW - DAY - 6 * HOUR },
  { id: 7, title: "Framer Adds Real-Time Multiplayer Cursors to Code Components", blurb: "Collaborators editing the same code component now see live cursors and selections, matching the canvas experience.", need: "Multiplayer is expanding from canvas-only into code-adjacent surfaces.", means: "If you ship a code-editing surface, multiplayer presence is becoming table stakes.", source: "Framer Blog", url: "https://framer.com/blog", publishedAt: NOW - DAY - 10 * HOUR },
  { id: 8, title: "Mobbin Adds Filtering by Interaction Pattern, Not Just Screen Type", blurb: "You can now search for 'pull to refresh' or 'swipe to delete' directly instead of browsing by screen category.", need: "Pattern-level search is more useful than screen-level search for interaction design research.", means: "When researching a specific interaction, search Mobbin by pattern name first.", source: "Mobbin", url: "https://mobbin.com", publishedAt: NOW - 2 * DAY - 2 * HOUR },
  { id: 9, title: "Are.na Launches Public API for Channel Data", blurb: "Third-party tools can now read (not write) any public channel's blocks and connections via a REST API.", need: "Curated reference boards are becoming programmable data sources, not just browsing destinations.", means: "Consider pulling an Are.na channel directly into a moodboard tool instead of manual copy-paste.", source: "Are.na", url: "https://are.na", publishedAt: NOW - 3 * DAY - 4 * HOUR },
  { id: 10, title: "Pinterest Rolls Out a Dedicated 'UI Reference' Board Type", blurb: "A new board type auto-tags pinned screenshots with detected UI patterns (nav bar, modal, empty state, etc).", need: "Pinterest is quietly becoming a structured UI reference tool, not just a moodboard.", means: "Worth a second look as a UI research source if you wrote it off as mood-only.", source: "Pinterest Newsroom", url: "https://newsroom.pinterest.com", publishedAt: NOW - 4 * DAY - HOUR },
  { id: 11, title: "GitHub Copilot Adds Design-System-Aware Suggestions", blurb: "Copilot can now read a project's design token file and suggest component props that match existing usage.", need: "AI coding assistants are starting to respect design systems instead of hallucinating arbitrary values.", means: "Keep your token file well-structured — it's becoming a direct input to AI suggestions.", source: "GitHub Blog", url: "https://github.blog", publishedAt: NOW - 5 * DAY - 8 * HOUR },
  { id: 12, title: "Adobe Firefly Adds Vector-Native Generation", blurb: "Firefly can now generate directly editable vector paths instead of rasterized output for icon and illustration prompts.", need: "Vector-native generation removes the trace-and-clean step that made AI illustration impractical for production icon work.", means: "Re-evaluate AI illustration tools for production use now that output is editable, not just referenceable.", source: "Adobe Blog", url: "https://blog.adobe.com", publishedAt: NOW - 6 * DAY - 12 * HOUR },
];

// ── Real feed: TLDR Design + UX Collective newsletters ──────────────────────
// Fetching, per-story splitting (TLDR's digest pages bundle ~15 stories into
// one RSS entry), relevance filtering, and need/means generation all happen
// server-side (server/tldrFeed.ts) — this just consumes the finished result,
// already scoped down to the articles worth a product designer's time.
const FEED_ARTICLES_URL = "/api/tldr/articles";

async function fetchFeedArticles(): Promise<TldrArticle[]> {
  const res = await fetch(FEED_ARTICLES_URL);
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return res.json();
}

const STORAGE_KEY = "dh_tldr_read_ids";

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage unavailable (private mode, etc) — read state just won't persist
  }
}

function byNewestFirst(a: TldrArticle, b: TldrArticle) {
  return b.publishedAt - a.publishedAt;
}

/** Shared read/unread state for TLDR articles, persisted to localStorage so
 *  Home (unread feed) and the Archive page (read articles) stay in sync.
 *  Merges the static mock pool with the real TLDR Design RSS feed, which is
 *  fetched fresh on every mount (i.e. every page load) and can be re-pulled
 *  on demand via refreshFeed. */
export function useTldrStore() {
  const [readIds, setReadIds] = useState<Set<number>>(() => loadReadIds());
  const [feedArticles, setFeedArticles] = useState<TldrArticle[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const refreshFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const articles = await fetchFeedArticles();
      setFeedArticles(articles);
      return true;
    } catch {
      // Keep whatever was already loaded — a failed refresh shouldn't wipe
      // out an earlier successful one.
      return false;
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const markAsRead = useCallback((id: number) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const sorted = [...TLDR_ARTICLES, ...feedArticles].sort(byNewestFirst);
  const unread = sorted.filter(a => !readIds.has(a.id));
  const archived = sorted.filter(a => readIds.has(a.id));

  return { unread, archived, markAsRead, refreshFeed, feedLoading };
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export type DayBucket = "today" | "yesterday" | "past";

export function dayBucket(publishedAt: number): DayBucket {
  const d = new Date(publishedAt);
  const today = new Date();
  if (isSameDay(d, today)) return "today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return "yesterday";
  return "past";
}

export function formatArticleTime(publishedAt: number): string {
  const d = new Date(publishedAt);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const bucket = dayBucket(publishedAt);
  if (bucket === "today") return `Today, ${timeStr}`;
  if (bucket === "yesterday") return `Yesterday, ${timeStr}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
}
