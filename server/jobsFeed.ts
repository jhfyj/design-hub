import path from "node:path";
import { CACHE_DIR, hashId, loadJson, saveJson } from "./htmlUtils";

// Per-company raw postings, keyed by company name — short-lived, just to
// avoid hammering Greenhouse/Ashby on every Home.tsx mount within a session.
const COMPANY_CACHE_FILE = path.join(CACHE_DIR, "jobs-companies.json");
const COMPANY_CACHE_TTL = 20 * 60 * 1000;
// The LLM's "which of these are the standout picks" output, keyed by a hash
// of the exact filtered candidate set + tags — only changes when the
// underlying postings or the user's watchlist criteria actually change.
const RECOMMENDED_CACHE_FILE = path.join(CACHE_DIR, "jobs-recommended.json");

const GREENHOUSE_BOARD_URL = (slug: string) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
const ASHBY_BOARD_URL = (slug: string) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
const MAX_RECOMMENDED = 4;

export interface JobPosting {
  id: number;
  company: string;
  role: string;
  postedAt: number;
  url: string;
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
}

async function fetchGreenhouseJobs(slug: string, company: string): Promise<JobPosting[]> {
  const resp = await fetch(GREENHOUSE_BOARD_URL(slug));
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
  }));
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt: string;
  isListed?: boolean;
}

async function fetchAshbyJobs(slug: string, company: string): Promise<JobPosting[]> {
  const resp = await fetch(ASHBY_BOARD_URL(slug));
  if (!resp.ok) throw new Error(`Ashby board "${slug}" fetch failed (${resp.status})`);
  const data = await resp.json() as { jobs?: AshbyJob[] };
  return (data.jobs ?? [])
    .filter(j => j.isListed !== false)
    .map(j => ({
      id: hashId(j.jobUrl),
      company,
      role: j.title,
      postedAt: Date.parse(j.publishedAt) || Date.now(),
      url: j.jobUrl,
    }));
}

// Tries Greenhouse then Ashby for a company's public job board. A pinned
// slug in KNOWN_ATS is tried first; otherwise this guesses the lowercased,
// space-stripped company name against both APIs. Never throws — a company
// with no board on either platform (or a guessed slug that doesn't match)
// just silently contributes zero postings, same as designInspoFeed.ts's
// per-source failure handling.
async function fetchCompanyJobsUncached(companyName: string): Promise<JobPosting[]> {
  const key = companyName.toLowerCase().trim();
  const guessedSlug = key.replace(/\s+/g, "");
  const known = KNOWN_ATS[key];

  const attempts: (() => Promise<JobPosting[]>)[] = known
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

async function fetchCompanyJobs(companyName: string): Promise<JobPosting[]> {
  const cache = loadJson<Record<string, { fetchedAt: number; jobs: JobPosting[] }>>(COMPANY_CACHE_FILE, {});
  const cached = cache[companyName];
  if (cached && Date.now() - cached.fetchedAt < COMPANY_CACHE_TTL) {
    return cached.jobs;
  }

  const jobs = await fetchCompanyJobsUncached(companyName);
  cache[companyName] = { fetchedAt: Date.now(), jobs };
  saveJson(COMPANY_CACHE_FILE, cache);
  return jobs;
}

function matchesAny(role: string, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const lower = role.toLowerCase();
  return tags.some(tag => lower.includes(tag.toLowerCase()));
}

function relevantScore(role: string, relevantTags: string[]): number {
  const lower = role.toLowerCase();
  return relevantTags.filter(tag => lower.includes(tag.toLowerCase())).length;
}

function candidateSetKey(candidates: JobPosting[], relevantTags: string[]): string {
  const ids = candidates.map(c => c.id).sort((a, b) => a - b).join(",");
  return `${relevantTags.slice().sort().join("|")}::${ids}`;
}

// One batched Claude call picks the standout "Agent Recommended" postings —
// same shape as tldrFeed.ts's selectRelevantArticles, but this is an
// annotation layer on top of an already-working feature (the must-include
// filter above already guarantees relevant results), so a missing API key
// or a failed call falls back to a plain relevant-tag-count ranking instead
// of throwing — unlike tldrFeed.ts, where the AI call IS the feature.
async function pickRecommended(candidates: JobPosting[], relevantTags: string[]): Promise<JobPosting[]> {
  const fallback = () =>
    [...candidates]
      .sort((a, b) => relevantScore(b.role, relevantTags) - relevantScore(a.role, relevantTags) || b.postedAt - a.postedAt)
      .slice(0, MAX_RECOMMENDED);

  if (candidates.length === 0) return [];

  const key = candidateSetKey(candidates, relevantTags);
  const cache = loadJson<Record<string, number[]>>(RECOMMENDED_CACHE_FILE, {});
  if (cache[key]) {
    const byId = new Map(candidates.map(c => [c.id, c]));
    const picked = cache[key].map(id => byId.get(id)).filter((c): c is JobPosting => !!c);
    if (picked.length > 0) return picked;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback();

  try {
    const prompt = `You are helping a product designer triage job postings against their saved watch-list criteria.

"Relevant" signals they care about (nice-to-have, not required): ${JSON.stringify(relevantTags)}

Candidate postings (already filtered to match their required role keywords):
${JSON.stringify(candidates.map(c => ({ id: c.id, company: c.company, role: c.role })))}

Pick up to ${MAX_RECOMMENDED} postings that best match the "relevant" signals above (seniority, remote, company stage, etc. as implied by the role title) — these become a highlighted "Agent Recommended" row. Respond with ONLY a JSON array of ids (no markdown fences, no other text), ordered best match first.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiResp.ok) return fallback();

    const data = await aiResp.json() as { content?: { type: string; text?: string }[] };
    const raw = data.content?.find(b => b.type === "text")?.text ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallback();
    const ids = JSON.parse(jsonMatch[0]) as number[];

    cache[key] = ids;
    saveJson(RECOMMENDED_CACHE_FILE, cache);

    const byId = new Map(candidates.map(c => [c.id, c]));
    const picked = ids.map(id => byId.get(id)).filter((c): c is JobPosting => !!c);
    return picked.length > 0 ? picked : fallback();
  } catch {
    return fallback();
  }
}

export async function getLiveJobs(
  companies: string[],
  mustTags: string[],
  relevantTags: string[],
): Promise<{ jobs: JobPosting[]; recommended: JobPosting[] }> {
  const results = await Promise.allSettled(companies.map(fetchCompanyJobs));
  const allPostings = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));

  const filtered = allPostings.filter(p => matchesAny(p.role, mustTags));
  const jobs = filtered.sort((a, b) => b.postedAt - a.postedAt);
  const recommended = await pickRecommended(jobs, relevantTags);

  // Keep the two lists disjoint — a recommended pick shouldn't also show up
  // in the main paginated grid.
  const recommendedIds = new Set(recommended.map(r => r.id));
  return { jobs: jobs.filter(j => !recommendedIds.has(j.id)), recommended };
}
