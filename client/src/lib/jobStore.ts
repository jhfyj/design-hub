import { useCallback, useEffect, useState } from "react";

export type WorkplaceType = "Remote" | "Hybrid" | "In-person";

export interface LiveJob {
  id: number;
  company: string;
  role: string;
  postedAt: number;
  url: string;
  workplaceType: WorkplaceType;
}

const JOBS_URL = "/api/jobs";

async function fetchLiveJobs(companies: string[], mustTags: string[], relevantTags: string[]): Promise<{ jobs: LiveJob[]; recommended: LiveJob[] }> {
  const params = new URLSearchParams({
    companies: companies.join(","),
    must: mustTags.join(","),
    relevant: relevantTags.join(","),
  });
  const res = await fetch(`${JOBS_URL}?${params}`);
  if (!res.ok) throw new Error(`Job feed request failed (${res.status})`);
  return res.json();
}

/** Live jobs pulled from each tracked company's real public job board
 *  (server/jobsFeed.ts), hard-filtered by the watch list's "must include"
 *  tags with an "Agent Recommended" subset picked by the "relevant" tags.
 *  Refetches whenever the watch-list criteria change; refresh() re-pulls
 *  the same criteria on demand. */
export function useJobStore(companies: string[], mustTags: string[], relevantTags: string[]) {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (companies.length === 0) {
      setJobs([]);
      setRecommendedJobs([]);
      return true;
    }
    setLoading(true);
    try {
      const { jobs: liveJobs, recommended } = await fetchLiveJobs(companies, mustTags, relevantTags);
      setJobs(liveJobs);
      setRecommendedJobs(recommended);
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setLoading(false);
    }
    // Re-run whenever the watchlist's criteria actually change, not on
    // every render — companies/tags arrays are recreated each render by
    // useJobWatchStore, so compare by content instead of identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.join(","), mustTags.join(","), relevantTags.join(",")]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { jobs, recommendedJobs, loading, error, refresh };
}
