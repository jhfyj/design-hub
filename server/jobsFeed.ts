import path from "node:path";
import { CACHE_DIR, decodeEntities, hashId, loadJson, saveJson, stripTags } from "./htmlUtils";

// Per-company raw postings, keyed by company name — short-lived, just to
// avoid hammering Greenhouse/Ashby on every Home.tsx mount within a session.
const COMPANY_CACHE_FILE = path.join(CACHE_DIR, "jobs-companies.json");
const COMPANY_CACHE_TTL = 20 * 60 * 1000;
// The LLM's "which of these are genuinely a match" output for the
// must-include filter, keyed by a hash of the coarse candidate set + tags.
const MUST_MATCH_CACHE_FILE = path.join(CACHE_DIR, "jobs-must-match.json");
// The LLM's "which of these are the standout picks" output for the
// Agent Recommended row, keyed by a hash of the filtered candidate set + tags.
const RECOMMENDED_CACHE_FILE = path.join(CACHE_DIR, "jobs-recommended.json");

const GREENHOUSE_BOARD_URL = (slug: string) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
const ASHBY_BOARD_URL = (slug: string) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
const MAX_RECOMMENDED = 4;
// How much of each posting's description the must-include classifier sees —
// long enough to judge genuine relevance, short enough to keep the prompt
// small even with dozens of candidates.
const DESCRIPTION_EXCERPT_LENGTH = 500;

export type WorkplaceType = "Remote" | "Hybrid" | "In-person";

export interface JobPosting {
  id: number;
  company: string;
  role: string;
  postedAt: number;
  url: string;
  workplaceType: WorkplaceType;
}

// description (plain text, full length) is only used inside this module's
// fetch/filter pipeline — stripped before a posting is returned from
// getLiveJobs.
interface RawJobPosting extends JobPosting {
  description: string;
}

// Neither board API gives a clean, always-present structured field for this
// (Ashby's workplaceType/isRemote often come back null), so a location-text
// heuristic is the fallback rather than leaving it undefined — "In-person"
// is the safe default when nothing in the text says otherwise.
function inferWorkplaceType(locationText: string): WorkplaceType {
  const lower = locationText.toLowerCase();
  if (lower.includes("hybrid")) return "Hybrid";
  if (lower.includes("remote")) return "Remote";
  return "In-person";
}

// Verified against each company's real public job board (Greenhouse or
// Ashby) — company display names don't reliably map to their ATS slug
// (e.g. spaces, rebrands), so known ones are pinned explicitly. Anything
// not listed here falls back to guessing the lowercased, space-stripped
// name against both APIs in fetchCompanyJobs.
const KNOWN_ATS: Record<string, { ats: "greenhouse" | "ashby"; slug: string }> = {
  figma: { ats: "greenhouse", slug: "figma" },
  stripe: { ats: "greenhouse", slug: "stripe" },
  vercel: { ats: "greenhouse", slug: "vercel" },
  airbnb: { ats: "greenhouse", slug: "airbnb" },
  duolingo: { ats: "greenhouse", slug: "duolingo" },
  pinterest: { ats: "greenhouse", slug: "pinterest" },
  discord: { ats: "greenhouse", slug: "discord" },
  anthropic: { ats: "greenhouse", slug: "anthropic" },
  notion: { ats: "ashby", slug: "notion" },
  linear: { ats: "ashby", slug: "linear" },
  miro: { ats: "ashby", slug: "miro" },
};

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location?: { name?: string };
  content?: string;
}

async function fetchGreenhouseJobs(slug: string, company: string): Promise<RawJobPosting[]> {
  // content=true pulls each job's full (HTML, entity-escaped) description
  // in the same request — needed so must-include tags can match anywhere
  // in the posting, not just the title.
  const resp = await fetch(`${GREENHOUSE_BOARD_URL(slug)}?content=true`);
  if (!resp.ok) throw new Error(`Greenhouse board "${slug}" fetch failed (${resp.status})`);
  const data = await resp.json() as { jobs?: GreenhouseJob[] };
  // Greenhouse's board-level endpoint doesn't expose a separate "first
  // published" date — updated_at is the closest available signal.
  return (data.jobs ?? []).map(j => ({
    id: hashId(j.absolute_url),
    company,
    role: j.title,
    postedAt: Date.parse(j.updated_at) || Date.now(),
    url: j.absolute_url,
    workplaceType: inferWorkplaceType(j.location?.name ?? ""),
    description: j.content ? stripTags(decodeEntities(j.content)) : "",
  }));
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt: string;
  isListed?: boolean;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
}

async function fetchAshbyJobs(slug: string, company: string): Promise<RawJobPosting[]> {
  const resp = await fetch(ASHBY_BOARD_URL(slug));
  if (!resp.ok) throw new Error(`Ashby board "${slug}" fetch failed (${resp.status})`);
  const data = await resp.json() as { jobs?: AshbyJob[] };
  return (data.jobs ?? [])
    .filter(j => j.isListed !== false)
    .map(j => {
      const workplaceType: WorkplaceType =
        j.workplaceType === "Remote" || j.workplaceType === "Hybrid"
          ? j.workplaceType
          : j.isRemote
          ? "Remote"
          : inferWorkplaceType(j.location ?? "");
      return {
        id: hashId(j.jobUrl),
        company,
        role: j.title,
        postedAt: Date.parse(j.publishedAt) || Date.now(),
        url: j.jobUrl,
        workplaceType,
        description: j.descriptionPlain ?? "",
      };
    });
}

// Tries Greenhouse then Ashby for a company's public job board. A pinned
// slug in KNOWN_ATS is tried first; otherwise this guesses the lowercased,
// space-stripped company name against both APIs. Never throws — a company
// with no board on either platform (or a guessed slug that doesn't match)
// just silently contributes zero postings, same as designInspoFeed.ts's
// per-source failure handling.
async function fetchCompanyJobsUncached(companyName: string): Promise<RawJobPosting[]> {
  const key = companyName.toLowerCase().trim();
  const guessedSlug = key.replace(/\s+/g, "");
  const known = KNOWN_ATS[key];

  const attempts: (() => Promise<RawJobPosting[]>)[] = known
    ? [
        () => (known.ats === "greenhouse" ? fetchGreenhouseJobs(known.slug, companyName) : fetchAshbyJobs(known.slug, companyName)),
      ]
    : [
        () => fetchGreenhouseJobs(guessedSlug, companyName),
        () => fetchAshbyJobs(guessedSlug, companyName),
      ];

  for (const attempt of attempts) {
    try {
      const jobs = await attempt();
      if (jobs.length > 0) return jobs;
    } catch {
      // try the next ATS, or give up quietly if this was the last one
    }
  }
  return [];
}

async function fetchCompanyJobs(companyName: string): Promise<RawJobPosting[]> {
  const cache = loadJson<Record<string, { fetchedAt: number; jobs: RawJobPosting[] }>>(COMPANY_CACHE_FILE, {});
  const cached = cache[companyName];
  if (cached && Date.now() - cached.fetchedAt < COMPANY_CACHE_TTL) {
    return cached.jobs;
  }

  const jobs = await fetchCompanyJobsUncached(companyName);
  cache[companyName] = { fetchedAt: Date.now(), jobs };
  saveJson(COMPANY_CACHE_FILE, cache);
  return jobs;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagWords(tags: string[]): string[] {
  return tags.flatMap(tag => tag.trim().split(/\s+/)).filter(Boolean);
}

// Title-based pre-filter: does this posting's TITLE mention ANY of the
// must-include words? Checking only the title (not the description) avoids
// false positives from boilerplate text that mentions "design" or "intern"
// in passing (e.g. "collaborate with design and engineering", "if you are
// an intern do not apply"). This is the coarse gate before Claude.
// Falls back to checking the description too when no title match is found
// at all — prevents a completely empty candidate set for unusual tag combos.
function mentionsAnyMustWord(posting: RawJobPosting, tags: string[]): boolean {
  const words = tagWords(tags);
  if (words.length === 0) return true;
  // Primary: title-only match (strict)
  const titleMatch = words.some(word => new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(posting.role));
  return titleMatch;
}

// Fallback when there's no ANTHROPIC_API_KEY (or the call fails): at least
// 80% of the individual must-include words need to show up somewhere in the
// posting. This is a strictly worse proxy than the LLM pass — plain keyword
// presence can't tell "Product Design Intern" apart from a backend role
// whose generic boilerplate happens to mention "design", or a posting that
// tells interns NOT to apply — but it's better than nothing when the AI
// call isn't available.
function matchesMustIncludeHeuristic(posting: RawJobPosting, tags: string[]): boolean {
  const words = tagWords(tags);
  if (words.length === 0) return true;
  const text = `${posting.role} ${posting.description}`;
  const matched = words.filter(word => new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(text)).length;
  return matched / words.length >= 0.8;
}

function candidateSetKey(ids: number[], tags: string[]): string {
  return `${tags.slice().sort().join("|")}::${ids.slice().sort((a, b) => a - b).join(",")}`;
}

// Shared Anthropic Messages API call — returns the response's text block,
// or null on any failure (missing key, network error, non-2xx, empty
// content). Callers decide their own fallback; this never throws.
async function callClaude(prompt: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { content?: { type: string; text?: string }[] };
    return data.content?.find(b => b.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

function parseIdArray(raw: string | null): number[] | null {
  if (!raw) return null;
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as number[];
  } catch {
    return null;
  }
}

// The real must-include filter: the tags describe ONE target role (e.g.
// "design", "intern", "fall" → "Product Design Intern (Fall)"), not a
// checklist of independent words to tally — so this asks Claude to judge
// genuine relevance rather than counting keyword hits, which was matching
// postings whose *unrelated* boilerplate happened to mention "design" in
// passing, or whose description told interns NOT to apply.
async function filterByMustInclude(postings: RawJobPosting[], mustTags: string[]): Promise<RawJobPosting[]> {
  if (mustTags.length === 0) return postings;

  const candidates = postings.filter(p => mentionsAnyMustWord(p, mustTags));
  if (candidates.length === 0) return [];

  const heuristicFallback = () => candidates.filter(p => matchesMustIncludeHeuristic(p, mustTags));

  const key = candidateSetKey(candidates.map(c => c.id), mustTags);
  const cache = loadJson<Record<string, number[]>>(MUST_MATCH_CACHE_FILE, {});
  let ids = cache[key];

  if (!ids) {
    const prompt = `You are triaging job postings for a PRODUCT DESIGNER's job search. This tool is a design-focused job watch list — all keywords should be interpreted in a design context: "design" means product/UX/UI design, NOT engineering "system design".

Required keywords (describe ONE target role together): ${JSON.stringify(mustTags)}
Example: ["Product Designer", "Intern", "Fall"] → looking for a Product Design Intern for Fall term.

IMPORTANT: The candidates below were pre-filtered so their JOB TITLE already contains at least one keyword. Your job is to confirm the title genuinely describes the target role — reject any posting where:
- The title is for a different discipline (e.g. "Software Engineer", "Data Analyst", "Marketing Manager")
- The keyword appears in the title as part of an unrelated phrase (e.g. "Design Systems Engineer" when looking for a product designer)
- The role is clearly out of scope (e.g. looking for "Intern" but the title is "Senior Product Designer")

Candidates (title is the primary signal; excerpt is for context only):
${JSON.stringify(candidates.map(c => ({ id: c.id, role: c.role, excerpt: c.description.slice(0, DESCRIPTION_EXCERPT_LENGTH) })))}

Respond with ONLY a JSON array of the ids that are genuine matches (no markdown fences, no other text). Return [] if none match.`;

    const parsed = parseIdArray(await callClaude(prompt, 1000));
    if (parsed) {
      ids = parsed;
      cache[key] = ids;
      saveJson(MUST_MATCH_CACHE_FILE, cache);
    }
  }

  if (!ids) return heuristicFallback();
  const idSet = new Set(ids);
  return candidates.filter(p => idSet.has(p.id));
}

function relevantScore(posting: JobPosting, relevantTags: string[]): number {
  const lower = posting.role.toLowerCase();
  const workplace = posting.workplaceType.toLowerCase();
  return relevantTags.filter(tag => lower.includes(tag.toLowerCase()) || workplace === tag.toLowerCase()).length;
}

// One batched Claude call picks the standout "Agent Recommended" postings —
// an annotation layer on top of the already-filtered must-include results,
// so a missing API key or a failed call falls back to a plain
// relevant-tag-count ranking instead of throwing.
async function pickRecommended(candidates: JobPosting[], relevantTags: string[]): Promise<JobPosting[]> {
  const fallback = () =>
    [...candidates]
      .sort((a, b) => relevantScore(b, relevantTags) - relevantScore(a, relevantTags) || b.postedAt - a.postedAt)
      .slice(0, MAX_RECOMMENDED);

  if (candidates.length === 0) return [];

  const key = candidateSetKey(candidates.map(c => c.id), relevantTags);
  const cache = loadJson<Record<string, number[]>>(RECOMMENDED_CACHE_FILE, {});
  if (cache[key]) {
    const byId = new Map(candidates.map(c => [c.id, c]));
    const picked = cache[key].map(id => byId.get(id)).filter((c): c is JobPosting => !!c);
    if (picked.length > 0) return picked;
  }

  const prompt = `You are helping a product designer triage job postings against their saved watch-list criteria.

"Relevant" signals they care about (nice-to-have, not required): ${JSON.stringify(relevantTags)}

Candidate postings (already filtered to match their required role keywords):
${JSON.stringify(candidates.map(c => ({ id: c.id, company: c.company, role: c.role, workplaceType: c.workplaceType })))}

Pick up to ${MAX_RECOMMENDED} postings that best match the "relevant" signals above (seniority and company stage as implied by the role title, workplaceType for remote/hybrid) — these become a highlighted "Agent Recommended" row. Respond with ONLY a JSON array of ids (no markdown fences, no other text), ordered best match first.`;

  const ids = parseIdArray(await callClaude(prompt, 500));
  if (!ids) return fallback();

  cache[key] = ids;
  saveJson(RECOMMENDED_CACHE_FILE, cache);

  const byId = new Map(candidates.map(c => [c.id, c]));
  const picked = ids.map(id => byId.get(id)).filter((c): c is JobPosting => !!c);
  return picked.length > 0 ? picked : fallback();
}

function stripDescription(p: RawJobPosting): JobPosting {
  const { description: _description, ...posting } = p;
  return posting;
}

export async function getLiveJobs(
  companies: string[],
  mustTags: string[],
  relevantTags: string[],
): Promise<{ jobs: JobPosting[]; recommended: JobPosting[] }> {
  const results = await Promise.allSettled(companies.map(fetchCompanyJobs));
  const allPostings = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));

  const filtered = await filterByMustInclude(allPostings, mustTags);
  const jobs = filtered.map(stripDescription).sort((a, b) => b.postedAt - a.postedAt);
  const recommended = await pickRecommended(jobs, relevantTags);

  // Keep the two lists disjoint — a recommended pick shouldn't also show up
  // in the main paginated grid.
  const recommendedIds = new Set(recommended.map(r => r.id));
  return { jobs: jobs.filter(j => !recommendedIds.has(j.id)), recommended };
}
