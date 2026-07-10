import path from "node:path";
import { CACHE_DIR, loadJson, saveJson } from "./htmlUtils";

// Clearbit's Autocomplete API — public, keyless, CORS-open, and covers
// essentially any registered company (not just a hand-picked list), which is
// why this lives server-side behind our own route rather than a hardcoded
// KNOWN_COMPANIES pool in the client.
const AUTOCOMPLETE_URL = (query: string) => `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`;

const CACHE_FILE = path.join(CACHE_DIR, "company-search.json");
// Company name → domain pairs practically never change — cache generously.
const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface CompanySuggestion {
  name: string;
  domain: string;
}

interface ClearbitCompany {
  name: string;
  domain: string;
}

export async function searchCompanies(query: string): Promise<CompanySuggestion[]> {
  const key = query.trim().toLowerCase();
  if (key.length === 0) return [];

  const cache = loadJson<Record<string, { fetchedAt: number; results: CompanySuggestion[] }>>(CACHE_FILE, {});
  const cached = cache[key];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.results;
  }

  try {
    const resp = await fetch(AUTOCOMPLETE_URL(key));
    if (!resp.ok) return cached?.results ?? [];
    const data = await resp.json() as ClearbitCompany[];
    const results = data.map(c => ({ name: c.name, domain: c.domain }));
    cache[key] = { fetchedAt: Date.now(), results };
    saveJson(CACHE_FILE, cache);
    return results;
  } catch {
    // Stale cache (if any) beats nothing; otherwise just no suggestions.
    return cached?.results ?? [];
  }
}
