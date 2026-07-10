import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

export type WorkplaceType = "Remote" | "Hybrid" | "In-person";

export interface LiveJob {
  id: number;
  company: string;
  role: string;
  postedAt: number;
  url: string;
  workplaceType: WorkplaceType;
}

/**
 * Live jobs pulled from each tracked company's real public job board
 * (server/jobsFeed.ts), filtered by the watch list's "must include" tags
 * with an "Agent Recommended" subset picked by the "relevant" tags.
 *
 * IMPORTANT: This hook does NOT auto-fetch on mount. Jobs are only loaded
 * when the user explicitly clicks the Refresh button (manual-only refresh).
 * On mount it reads the DB cache via trpc.jobs.getCached — no API call.
 */
export function useJobStore(companies: string[], mustTags: string[], relevantTags: string[]) {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [initialised, setInitialised] = useState(false);

  // Stabilise the input object so useQuery doesn't re-run on every render
  // (arrays created inline have new references each render → infinite queries).
  const cacheInput = useMemo(
    () => ({ companies, mustTags, relevantTags }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies.join(","), mustTags.join(","), relevantTags.join(",")],
  );

  // Read-only cache query — runs once on mount, no refetch.
  // Returns the last persisted result without triggering a fresh API call.
  const { data: cachedData } = trpc.jobs.getCached.useQuery(cacheInput, {
    enabled: companies.length > 0 && !initialised,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  // Populate state from cache on first load
  useEffect(() => {
    if (cachedData !== undefined && !initialised) {
      if (cachedData) {
        setJobs((cachedData.jobs ?? []) as LiveJob[]);
        setRecommendedJobs((cachedData.recommended ?? []) as LiveJob[]);
      }
      setInitialised(true);
    }
  }, [cachedData, initialised]);

  // Also mark as initialised when companies list is empty (no query will run)
  useEffect(() => {
    if (companies.length === 0 && !initialised) {
      setInitialised(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length, initialised]);

  const refreshMutation = trpc.jobs.refresh.useMutation();

  /** Manual-only refresh — only called when the user clicks the Refresh button. */
  const refresh = useCallback(async () => {
    if (companies.length === 0) {
      setJobs([]);
      setRecommendedJobs([]);
      return true;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await refreshMutation.mutateAsync({
        companies,
        mustTags,
        relevantTags,
      });
      setJobs((result.jobs ?? []) as LiveJob[]);
      setRecommendedJobs((result.recommended ?? []) as LiveJob[]);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.join(","), mustTags.join(","), relevantTags.join(",")]);

  return { jobs, recommendedJobs, loading, error, refresh };
}
