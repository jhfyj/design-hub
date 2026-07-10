import { useCallback, useState } from "react";

export interface Company {
  id: number;
  name: string;
  url?: string;
  // Real domain (e.g. from the company-search autocomplete) — lets the logo
  // use an authoritative lookup instead of guessing a slug from the name.
  domain?: string;
}

const INITIAL_COMPANIES: Company[] = [
  { id: 1, name: "FIGMA" },
  { id: 2, name: "NOTION" },
  { id: 3, name: "LINEAR" },
  { id: 4, name: "VERCEL" },
  { id: 5, name: "STRIPE" },
  { id: 6, name: "LOOM" },
  { id: 7, name: "MIRO" },
  { id: 8, name: "FRAMER" },
];

const INITIAL_MUST = ["Product Designer", "UX Designer", "Design Engineer", "UI Designer"];
const INITIAL_RELEVANT = ["Senior", "Lead", "Remote", "Full-time", "Startup", "Series B+"];

const STORAGE_KEY = "dh_job_watchlist";

interface WatchlistState {
  companies: Company[];
  mustTags: string[];
  relevantTags: string[];
  nextCompanyId: number;
}

function loadState(): WatchlistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no saved watchlist");
    return JSON.parse(raw);
  } catch {
    return { companies: INITIAL_COMPANIES, mustTags: INITIAL_MUST, relevantTags: INITIAL_RELEVANT, nextCompanyId: 1000 };
  }
}

function saveState(state: WatchlistState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, etc) — watchlist just won't persist
  }
}

// Shared companies/must-include/relevant tags, persisted to localStorage so
// JobWatchList.tsx (editing) and Home.tsx (reading, to drive the live job
// fetch) stay in sync across navigation — each mounts its own hook instance,
// but both read/write the same storage key.
export function useJobWatchStore() {
  const [state, setState] = useState<WatchlistState>(() => loadState());

  const update = useCallback((fn: (prev: WatchlistState) => WatchlistState) => {
    setState(prev => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addCompany = useCallback((company: { name: string; url?: string; domain?: string }) => {
    update(prev => ({
      ...prev,
      companies: [...prev.companies, {
        id: prev.nextCompanyId, name: company.name.toUpperCase(),
        url: company.url, domain: company.domain,
      }],
      nextCompanyId: prev.nextCompanyId + 1,
    }));
  }, [update]);

  const removeCompany = useCallback((id: number) => {
    update(prev => ({ ...prev, companies: prev.companies.filter(c => c.id !== id) }));
  }, [update]);

  const updateCompanyUrl = useCallback((id: number, url: string) => {
    update(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === id ? { ...c, url: url || undefined } : c),
    }));
  }, [update]);

  const addMustTag = useCallback((tag: string) => {
    update(prev => ({ ...prev, mustTags: [...prev.mustTags, tag] }));
  }, [update]);

  const removeMustTag = useCallback((tag: string) => {
    update(prev => ({ ...prev, mustTags: prev.mustTags.filter(t => t !== tag) }));
  }, [update]);

  const addRelevantTag = useCallback((tag: string) => {
    update(prev => ({ ...prev, relevantTags: [...prev.relevantTags, tag] }));
  }, [update]);

  const removeRelevantTag = useCallback((tag: string) => {
    update(prev => ({ ...prev, relevantTags: prev.relevantTags.filter(t => t !== tag) }));
  }, [update]);

  return {
    companies: state.companies,
    mustTags: state.mustTags,
    relevantTags: state.relevantTags,
    addCompany,
    removeCompany,
    updateCompanyUrl,
    addMustTag,
    removeMustTag,
    addRelevantTag,
    removeRelevantTag,
  };
}
