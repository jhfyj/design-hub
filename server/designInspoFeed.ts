import path from "node:path";
import { CACHE_DIR, decodeEntities, hashId, loadJson, saveJson } from "./htmlUtils";

// Channel slugs picked once via are.na's channel search and cached forever —
// re-running the search on every refresh would be pointless since the same
// well-followed channels keep coming out on top for these query terms.
const ARENA_CHANNELS_CACHE_FILE = path.join(CACHE_DIR, "arena-channels.json");

const MOTION_EXAMPLES_URL = "https://motion.dev/examples";
const COMPONENTRY_DOCS_URL = "https://componentry.dev/docs";
const ACETERNITY_API_URL = "https://ui.aceternity.com/api/components";
const ARENA_QUERY_TERMS = ["ui design", "visual design", "typography", "motion design", "graphic design"];
const ARENA_BLOCKS_PER_CHANNEL = 8;

export interface InspoItem {
  id: number;
  title: string;
  // Always present except for a handful of Aceternity entries that only
  // ship a video preview and no static frame.
  image?: string;
  // Some Aceternity components ship a real screen-recording of the actual
  // interaction (not just a static frame) — when present, the client plays
  // it on hover instead of showing the static image.
  video?: string;
  url: string;
  source: string;
}

// motion.dev/examples is a static, server-rendered gallery of animation demos
// — each <a class="ex-card ...href="/examples/...">  wraps a thumbnail image
// and a title, with no nested <a> inside, so a non-greedy match up to the
// next </a> cleanly closes each card.
function parseMotionDevExamples(html: string): InspoItem[] {
  const items: InspoItem[] = [];
  const cardRe = /<a class="ex-card[^"]*"[^>]*href="([^"]+)"[\s\S]*?<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html))) {
    const block = m[0];
    const href = m[1];
    const image = block.match(/<img class="ex-card-thumb" src="([^"]+)"/)?.[1];
    const title = block.match(/<span class="ex-card-title">([^<]*)<\/span>/)?.[1];
    if (!image || !title) continue;
    const url = href.startsWith("http") ? href : `https://motion.dev${href}`;
    items.push({ id: hashId(url), title: decodeEntities(title), image, url, source: "motion.dev" });
  }
  return items;
}

async function fetchMotionDevItems(): Promise<InspoItem[]> {
  const resp = await fetch(MOTION_EXAMPLES_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`motion.dev fetch failed (${resp.status})`);
  return parseMotionDevExamples(await resp.text());
}

// componentry.dev/docs lists each component as a static card: a single-frame
// preview thumbnail (not animated — the real hover interaction only exists
// as client-rendered JS on the component's own page), a title, a
// description, and a link. Same static-card shape as motion.dev.
function parseComponentryDocs(html: string): InspoItem[] {
  const items: InspoItem[] = [];
  const cardRe = /<a class="group relative flex flex-col[^"]*"[^>]*href="([^"]+)"[\s\S]*?<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html))) {
    const block = m[0];
    const href = m[1];
    const image = block.match(/<img src="([^"]+)"/)?.[1];
    const title = block.match(/<h3[^>]*>([^<]*)<\/h3>/)?.[1];
    if (!image || !title) continue;
    const url = href.startsWith("http") ? href : `https://componentry.dev${href}`;
    items.push({ id: hashId(url), title: decodeEntities(title), image, url, source: "componentry.dev" });
  }
  return items;
}

async function fetchComponentryItems(): Promise<InspoItem[]> {
  const resp = await fetch(COMPONENTRY_DOCS_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`componentry.dev fetch failed (${resp.status})`);
  return parseComponentryDocs(await resp.text());
}

// ui.aceternity.com publishes an llms.txt that explicitly names and invites
// AI/LLM use of this exact JSON API (superseding the site's generic legacy
// `Disallow: /api/` in robots.txt, which predates that invitation and is
// aimed at stopping search-crawler indexing, not this use). It's already
// structured — no HTML scraping needed — and unlike the other sources, ~23
// of its 109 components ship a real preview video of the actual interaction.
interface AceternityComponent {
  title: string;
  description?: string;
  documentationUrl: string;
  image?: string | null;
  video?: string | null;
}

async function fetchAceternityItems(): Promise<InspoItem[]> {
  const resp = await fetch(ACETERNITY_API_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`ui.aceternity.com fetch failed (${resp.status})`);
  const data = await resp.json() as { components?: AceternityComponent[] };

  const items: InspoItem[] = [];
  for (const c of data.components ?? []) {
    if (!c.image && !c.video) continue;
    items.push({
      id: hashId(c.documentationUrl),
      title: c.title,
      image: c.image ?? undefined,
      video: c.video ?? undefined,
      url: c.documentationUrl,
      source: "Aceternity UI",
    });
  }
  return items;
}

// ── are.na ───────────────────────────────────────────────────────────────
interface ArenaChannelPick {
  slug: string;
  title: string;
}

interface ArenaSearchChannel {
  slug: string;
  title: string;
  published: boolean;
  length: number;
  follower_count?: number;
}

interface ArenaBlock {
  id: number;
  title?: string;
  generated_title?: string;
  image?: { original?: { url?: string } };
  source?: { url?: string };
}

// are.na's old site-wide "explore/trending" endpoint has been sunset, but
// channel search is still live — this picks the most-followed public channel
// per design-related query term, standing in for a curated discovery feed.
async function pickArenaChannels(): Promise<ArenaChannelPick[]> {
  const cached = loadJson<ArenaChannelPick[]>(ARENA_CHANNELS_CACHE_FILE, []);
  if (cached.length > 0) return cached;

  const picks: ArenaChannelPick[] = [];
  const seenSlugs = new Set<string>();

  for (const term of ARENA_QUERY_TERMS) {
    const resp = await fetch(`https://api.are.na/v2/search/channels?q=${encodeURIComponent(term)}&per=20`);
    if (!resp.ok) continue;
    const data = await resp.json() as { channels?: ArenaSearchChannel[] };
    const top = (data.channels ?? [])
      .filter(c => c.published && c.length >= 8 && !seenSlugs.has(c.slug))
      .sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))[0];
    if (top) {
      picks.push({ slug: top.slug, title: top.title });
      seenSlugs.add(top.slug);
    }
  }

  if (picks.length > 0) saveJson(ARENA_CHANNELS_CACHE_FILE, picks);
  return picks;
}

async function fetchArenaChannelItems(channel: ArenaChannelPick): Promise<InspoItem[]> {
  const resp = await fetch(`https://api.are.na/v2/channels/${channel.slug}?per=${ARENA_BLOCKS_PER_CHANNEL}`);
  if (!resp.ok) return [];
  const data = await resp.json() as { contents?: ArenaBlock[] };

  const items: InspoItem[] = [];
  for (const block of data.contents ?? []) {
    const image = block.image?.original?.url;
    if (!image) continue;
    const url = block.source?.url || `https://www.are.na/block/${block.id}`;
    const title = block.title || block.generated_title || channel.title;
    items.push({ id: hashId(`${url}${image}`), title: decodeEntities(title), image, url, source: `Are.na — ${channel.title}` });
  }
  return items;
}

async function fetchArenaItems(): Promise<InspoItem[]> {
  const channels = await pickArenaChannels();
  const results = await Promise.allSettled(channels.map(fetchArenaChannelItems));
  return results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
}

export async function getInspoItems(): Promise<InspoItem[]> {
  const [motionResult, componentryResult, aceternityResult, arenaResult] = await Promise.allSettled([
    fetchMotionDevItems(),
    fetchComponentryItems(),
    fetchAceternityItems(),
    fetchArenaItems(),
  ]);
  const motionItems = motionResult.status === "fulfilled" ? motionResult.value : [];
  const componentryItems = componentryResult.status === "fulfilled" ? componentryResult.value : [];
  const aceternityItems = aceternityResult.status === "fulfilled" ? aceternityResult.value : [];
  const arenaItems = arenaResult.status === "fulfilled" ? arenaResult.value : [];
  if (motionItems.length === 0 && componentryItems.length === 0 && aceternityItems.length === 0 && arenaItems.length === 0) {
    throw motionResult.status === "rejected" ? motionResult.reason : (arenaResult as PromiseRejectedResult).reason;
  }
  return [...motionItems, ...componentryItems, ...aceternityItems, ...arenaItems];
}
