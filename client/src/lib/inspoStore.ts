import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";

export interface InspoItem {
  id: number;
  title: string;
  // Always present except for a handful of Aceternity entries that only
  // ship a video preview and no static frame.
  image?: string;
  // Some Aceternity components ship a real screen-recording of the actual
  // interaction — when present, the card plays it on hover.
  video?: string;
  url: string;
  source: string;
}

const INITIAL_COUNT = 24;
const BATCH_SIZE = 15;
// Scrolling to the bottom re-triggers a "fresh batch" load up to this many
// times per shuffle, after which the board says to come back tomorrow —
// there's still plenty left in the pool, but this keeps a session's browsing
// bounded rather than letting it scroll through the entire ~450-item pool.
const MAX_SCROLL_BATCHES = 4;
// How long the trailing shimmer placeholders stay up before the next batch
// swaps in — long enough to read as "loading", short enough not to feel slow.
const LOAD_MORE_DELAY_MS = 700;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Design Inspos board — fetches real scraped items (motion.dev, are.na;
 *  see server/designInspoFeed.ts) once on mount into a shuffled pool via tRPC,
 *  then shows a growing slice of it: an initial batch to fill the section, plus
 *  up to MAX_SCROLL_BATCHES more as the user scrolls to the bottom. "Refresh"
 *  reshuffles the pool and restarts pagination, all client-side — no refetch. */
export function useInspoStore() {
  const [pool, setPool] = useState<InspoItem[]>([]);
  const [items, setItems] = useState<InspoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchesLoaded, setBatchesLoaded] = useState(0);
  const reachedEnd = batchesLoaded >= MAX_SCROLL_BATCHES;

  // Fetch inspo items via tRPC on mount
  const { data: inspoData, isLoading: queryLoading } = trpc.inspo.getItems.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000, // 30 min — inspo items don't change often
  });

  useEffect(() => {
    if (inspoData?.items) {
      const shuffled = shuffleArray(inspoData.items as InspoItem[]);
      setPool(shuffled);
      setItems(shuffled.slice(0, INITIAL_COUNT));
      setBatchesLoaded(0);
    }
  }, [inspoData]);

  useEffect(() => {
    setLoading(queryLoading);
  }, [queryLoading]);

  // Reshuffling is instant (client-side only, no refetch) — the brief
  // loading pulse exists purely so the refresh button's icon has something
  // to spin against.
  const reshuffle = useCallback(() => {
    setLoading(true);
    const shuffled = shuffleArray(pool);
    setPool(shuffled);
    setItems(shuffled.slice(0, INITIAL_COUNT));
    setBatchesLoaded(0);
    setTimeout(() => setLoading(false), 400);
  }, [pool]);

  const loadMore = useCallback(() => {
    if (loadingMore || reachedEnd || pool.length === 0) return;
    setLoadingMore(true);
    setTimeout(() => {
      setItems(prev => [...prev, ...pool.slice(prev.length, prev.length + BATCH_SIZE)]);
      setBatchesLoaded(b => b + 1);
      setLoadingMore(false);
    }, LOAD_MORE_DELAY_MS);
  }, [loadingMore, reachedEnd, pool]);

  return { items, loading, loadingMore, reachedEnd, reshuffle, loadMore };
}
