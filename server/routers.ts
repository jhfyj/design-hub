import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { searchCompanies } from "./companySearch";
import {
  CachedJobResult,
  getJobCache,
  getJobWatchList,
  getTldrCache,
  jobQueryHash,
  setJobCache,
  setJobWatchList,
  setTldrCache,
  sha256,
  WatchListData,
} from "./db";
import { getInspoItems } from "./designInspoFeed";
import { getLiveJobs } from "./jobsFeed";
import { getFeedArticles } from "./tldrFeed";

// ── Shared input schemas ──────────────────────────────────────────────────────

const CompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().optional(),
  domain: z.string().optional(),
});

const WatchListSchema = z.object({
  companies: z.array(CompanySchema),
  mustTags: z.array(z.string()),
  relevantTags: z.array(z.string()),
});

// Default watch list — mirrors the localStorage defaults in jobWatchStore.ts
// so a fresh install without any DB row still shows useful content.
const DEFAULT_WATCH_LIST: WatchListData = {
  companies: [
    { id: 1, name: "FIGMA" },
    { id: 2, name: "NOTION" },
    { id: 3, name: "LINEAR" },
    { id: 4, name: "VERCEL" },
    { id: 5, name: "STRIPE" },
    { id: 6, name: "LOOM" },
    { id: 7, name: "MIRO" },
    { id: 8, name: "FRAMER" },
  ],
  mustTags: ["Product Designer", "UX Designer", "Design Engineer", "UI Designer"],
  relevantTags: ["Senior", "Lead", "Remote", "Full-time", "Startup", "Series B+"],
};

// 4-hour TLDR cache TTL — avoids redundant Claude calls when the feed hasn't
// changed since the last summarisation run.
const TLDR_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Jobs ──────────────────────────────────────────────────────────────────
  jobs: router({
    /** Return the persisted watch list from DB, falling back to defaults. */
    getWatchList: publicProcedure.query(async () => {
      const saved = await getJobWatchList();
      return saved ?? DEFAULT_WATCH_LIST;
    }),

    /** Persist the watch list to DB. */
    setWatchList: publicProcedure.input(WatchListSchema).mutation(async ({ input }) => {
      await setJobWatchList(input);
      return { success: true } as const;
    }),

    /**
     * Manual-only job refresh.
     *
     * Flow:
     *  1. Compute queryHash from (companies, mustTags, relevantTags)
     *  2. Fetch raw postings from Greenhouse/Ashby
     *  3. Hash the raw payload
     *  4. If payloadHash unchanged → return cached result (skip Claude)
     *  5. Otherwise run full filter+recommend pipeline, update DB cache
     */
    refresh: publicProcedure
      .input(
        z.object({
          companies: z.array(z.string()),
          mustTags: z.array(z.string()),
          relevantTags: z.array(z.string()),
        }),
      )
      .mutation(async ({ input }) => {
        const { companies, mustTags, relevantTags } = input;

        if (companies.length === 0) {
          return { jobs: [], recommended: [], fromCache: false } as const;
        }

        const qHash = jobQueryHash(companies, mustTags, relevantTags);
        const cached = await getJobCache(qHash);

        // Fetch raw postings to compute the payload hash for change detection.
        // getLiveJobs does its own in-memory company cache (20 min TTL) so
        // this is fast on repeated refreshes within a session.
        let result: CachedJobResult;
        try {
          const fresh = await getLiveJobs(companies, mustTags, relevantTags);
          const payloadHash = sha256(JSON.stringify(fresh));

          if (cached && cached.payloadHash === payloadHash) {
            // Payload unchanged — return the cached result without re-running Claude.
            return { ...cached.result, fromCache: true } as const;
          }

          result = fresh as CachedJobResult;
          await setJobCache(qHash, payloadHash, result);
        } catch (err) {
          // If the live fetch fails but we have a cached result, return it.
          if (cached) {
            return { ...cached.result, fromCache: true } as const;
          }
          throw err;
        }

        return { ...result, fromCache: false } as const;
      }),

    /** Return the cached job result without triggering a fresh fetch. */
    getCached: publicProcedure
      .input(
        z.object({
          companies: z.array(z.string()),
          mustTags: z.array(z.string()),
          relevantTags: z.array(z.string()),
        }),
      )
      .query(async ({ input }) => {
        const { companies, mustTags, relevantTags } = input;
        if (companies.length === 0) return null;
        const qHash = jobQueryHash(companies, mustTags, relevantTags);
        const cached = await getJobCache(qHash);
        if (!cached) return null;
        return { ...cached.result, fetchedAt: cached.fetchedAt };
      }),
  }),

  // ── TLDR ──────────────────────────────────────────────────────────────────
  tldr: router({
    /**
     * Return TLDR articles.
     * If the DB cache is fresh (< 4h), return it without calling Claude.
     * Otherwise fetch + summarise + update cache.
     */
    getArticles: publicProcedure.query(async () => {
      const cached = await getTldrCache();
      if (cached && Date.now() - cached.fetchedAt < TLDR_CACHE_TTL_MS) {
        return { articles: cached.articles, fromCache: true };
      }
      // Stale or missing — fetch fresh
      const articles = await getFeedArticles();
      const payloadHash = sha256(JSON.stringify(articles));
      await setTldrCache(payloadHash, articles);
      return { articles, fromCache: false };
    }),

    /** Force-refresh TLDR feed regardless of cache age. */
    refresh: publicProcedure.mutation(async () => {
      const articles = await getFeedArticles();
      const payloadHash = sha256(JSON.stringify(articles));
      await setTldrCache(payloadHash, articles);
      return { articles, fromCache: false };
    }),
  }),

  // ── Design Inspos ─────────────────────────────────────────────────────────
  inspo: router({
    /** Proxy to getInspoItems() — no DB persistence (ephemeral/large). */
    getItems: publicProcedure.query(async () => {
      const items = await getInspoItems();
      return { items };
    }),
  }),

  // ── Company search ────────────────────────────────────────────────────────
  companies: router({
    /** Proxy to Clearbit autocomplete via searchCompanies(). */
    search: publicProcedure
      .input(z.object({ q: z.string() }))
      .query(async ({ input }) => {
        const results = await searchCompanies(input.q);
        return { results };
      }),
  }),
});

export type AppRouter = typeof appRouter;
