import path from "node:path";
import { CACHE_DIR, decodeEntities, hashId as baseHashId, loadJson, saveJson, stripTags } from "./htmlUtils";

// Raw per-story data, keyed by the TLDR digest page URL it was parsed from —
// digest pages don't change once published, so this never needs re-fetching.
const STORY_CACHE_FILE = path.join(CACHE_DIR, "tldr-stories.json");
// The LLM's relevance-selection + need/means output, keyed by a hash of the
// candidate id set — only changes when a new digest/post actually appears.
const SELECTION_CACHE_FILE = path.join(CACHE_DIR, "tldr-selection.json");

const TLDR_RSS_URL = "https://tldr.tech/api/rss/design";
const UX_RSS_URL = "https://newsletter.uxdesign.cc/feed";
const DIGESTS_TO_SCAN = 2; // each TLDR digest bundles ~15 stories
const UX_POSTS_TO_SCAN = 6;
const TLDR_MAX_SELECTED = 8;
const UX_MAX_SELECTED = 6;

export interface FeedArticle {
  id: number;
  title: string;
  blurb: string;
  need: string;
  means: string;
  source: string;
  url: string;
  publishedAt: number;
}

interface CandidateArticle {
  id: number;
  title: string;
  blurb: string;
  source: string;
  url: string;
  publishedAt: number;
}

// Namespaced above 100000 to stay clear of tldrStore.ts's mock article ids (1-12).
function hashId(str: string): number {
  return 100000 + baseHashId(str);
}

// TLDR digest pages (e.g. tldr.tech/design/2026-07-03) bundle ~15 separate
// stories into one page, each already grouped into a <section> with its own
// <article>: an external link, a headline, and a human-written blurb. This
// pulls those apart into individual candidate articles instead of treating
// the whole digest as a single "article" (the bug this replaces).
function parseDigestStories(html: string, digestUrl: string): CandidateArticle[] {
  const publishedAt = Date.parse(digestUrl.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "") || Date.now();
  const stories: CandidateArticle[] = [];

  const sectionRe = /<section>([\s\S]*?)<\/section>/g;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRe.exec(html))) {
    const section = sectionMatch[1];
    if (!section.includes("<header>")) continue;

    const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/g;
    let articleMatch: RegExpExecArray | null;
    while ((articleMatch = articleRe.exec(section))) {
      const block = articleMatch[1];
      const href = block.match(/href="([^"]+)"/)?.[1];
      const rawTitle = block.match(/<h3>([^<]*)<\/h3>/)?.[1];
      const rawBlurb = block.match(/<div class="newsletter-html">([\s\S]*?)<\/div>/)?.[1];
      if (!href || !rawTitle) continue;

      const title = decodeEntities(rawTitle).replace(/\s*\((?:\d+ minute read|Website)\)\s*$/, "").trim();
      stories.push({
        id: hashId(href),
        title,
        blurb: rawBlurb ? stripTags(rawBlurb) : "",
        source: "TLDR Design",
        url: href,
        publishedAt,
      });
    }
  }
  return stories;
}

async function fetchTldrCandidates(): Promise<CandidateArticle[]> {
  const rssResp = await fetch(TLDR_RSS_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!rssResp.ok) throw new Error(`TLDR RSS fetch failed (${rssResp.status})`);
  const rssXml = await rssResp.text();
  const digestUrls = Array.from(rssXml.matchAll(/<link>([^<]+)<\/link>/g))
    .map(m => m[1])
    .filter(u => u.includes("/design/"))
    .slice(0, DIGESTS_TO_SCAN);

  const storyCache = loadJson<Record<string, CandidateArticle[]>>(STORY_CACHE_FILE, {});
  let cacheDirty = false;
  const all: CandidateArticle[] = [];

  for (const digestUrl of digestUrls) {
    if (!storyCache[digestUrl]) {
      const pageResp = await fetch(digestUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!pageResp.ok) continue;
      const html = await pageResp.text();
      storyCache[digestUrl] = parseDigestStories(html, digestUrl);
      cacheDirty = true;
    }
    all.push(...storyCache[digestUrl]);
  }

  if (cacheDirty) saveJson(STORY_CACHE_FILE, storyCache);
  return all;
}

// UX Collective (newsletter.uxdesign.cc) is a Substack feed — unlike TLDR,
// each RSS item is already exactly one article, so no splitting is needed.
// Its <description> is a fixed tagline repeated on every item, not a per-post
// summary, so the blurb comes from the start of <content:encoded> instead.
async function fetchUxCollectiveCandidates(): Promise<CandidateArticle[]> {
  const resp = await fetch(UX_RSS_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`UX Collective RSS fetch failed (${resp.status})`);
  const xml = await resp.text();

  const items: CandidateArticle[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < UX_POSTS_TO_SCAN) {
    const block = m[1];
    const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim();
    const link = block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    const contentEncoded = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1];
    if (!title || !link) continue;

    const fullText = contentEncoded ? stripTags(contentEncoded) : "";
    const blurb = fullText.length > 260 ? `${fullText.slice(0, 260).replace(/\s+\S*$/, "")}…` : fullText;
    items.push({
      id: hashId(link),
      title: decodeEntities(title),
      blurb,
      source: "UX Collective",
      url: link,
      publishedAt: pubDate ? Date.parse(pubDate) : Date.now(),
    });
  }
  return items;
}

function candidateSetKey(candidates: CandidateArticle[], maxSelected: number): string {
  return `${maxSelected}:${candidates.map(c => c.id).sort((a, b) => a - b).join(",")}`;
}

// One batched Claude call per source does both jobs at once: picks the
// subset actually worth a product designer's time (dropping generic
// business/eng news that rides along in these newsletters), and writes the
// need/means insight for each pick. Run separately per source (rather than
// pooling every candidate into one global contest) so TLDR Design's larger
// daily volume can't crowd out UX Collective's less frequent long-form
// pieces — each newsletter is judged on its own merits. Cached per exact
// candidate set, so a same-day refresh with no new digest/post is free.
async function selectRelevantArticles(candidates: CandidateArticle[], maxSelected: number): Promise<Map<number, { need: string; means: string }>> {
  const key = candidateSetKey(candidates, maxSelected);
  const selectionCache = loadJson<Record<string, { id: number; need: string; means: string }[]>>(SELECTION_CACHE_FILE, {});
  if (selectionCache[key]) {
    return new Map(selectionCache[key].map(item => [item.id, { need: item.need, means: item.means }]));
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const prompt = `You are curating a daily reading feed for a product designer. Below is a list of candidate articles pulled from a design/tech newsletter. Each has an id, title, and a short blurb.

Pick up to ${maxSelected} of the most important and relevant articles for a PRODUCT DESIGNER's day-to-day work — prioritize design tools, UX/UI trends, design systems, accessibility, and design-adjacent AI news. Drop generic business/funding news, pure backend engineering news, and redundant or low-value items unless they are directly design-relevant. It's fine to select fewer than ${maxSelected} if not enough candidates are genuinely relevant.

Candidates:
${JSON.stringify(candidates.map(c => ({ id: c.id, title: c.title, blurb: c.blurb })))}

Respond with ONLY a JSON array (no markdown fences, no other text) of up to ${maxSelected} objects, each with exactly these keys:
- "id": the candidate's id, copied exactly.
- "need": 1-2 sentences on the key facts a product designer needs to know from this article.
- "means": 1-2 sentences on what this means for a designer's day-to-day work — the actionable takeaway.

Order the array from most to least important.`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text().catch(() => "");
    throw new Error(`Anthropic API error (${aiResp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await aiResp.json() as { content?: { type: string; text?: string }[] };
  const raw = data.content?.find(b => b.type === "text")?.text ?? "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse selection response");
  const parsed = JSON.parse(jsonMatch[0]) as { id: number; need: string; means: string }[];

  selectionCache[key] = parsed;
  saveJson(SELECTION_CACHE_FILE, selectionCache);
  return new Map(parsed.map(item => [item.id, { need: item.need, means: item.means }]));
}

export async function getFeedArticles(): Promise<FeedArticle[]> {
  const [tldrResult, uxResult] = await Promise.allSettled([
    fetchTldrCandidates(),
    fetchUxCollectiveCandidates(),
  ]);
  const tldrCandidates = tldrResult.status === "fulfilled" ? tldrResult.value : [];
  const uxCandidates = uxResult.status === "fulfilled" ? uxResult.value : [];
  if (tldrCandidates.length === 0 && uxCandidates.length === 0) {
    throw tldrResult.status === "rejected" ? tldrResult.reason : (uxResult as PromiseRejectedResult).reason;
  }

  const [tldrSelection, uxSelection] = await Promise.all([
    tldrCandidates.length ? selectRelevantArticles(tldrCandidates, TLDR_MAX_SELECTED) : new Map<number, { need: string; means: string }>(),
    uxCandidates.length ? selectRelevantArticles(uxCandidates, UX_MAX_SELECTED) : new Map<number, { need: string; means: string }>(),
  ]);

  return [
    ...tldrCandidates.filter(c => tldrSelection.has(c.id)).map(c => ({ ...c, ...tldrSelection.get(c.id)! })),
    ...uxCandidates.filter(c => uxSelection.has(c.id)).map(c => ({ ...c, ...uxSelection.get(c.id)! })),
  ];
}
