# Design Hub — TODO

## Backend / Database

- [x] Add `job_cache`, `job_watch_list`, `tldr_cache` tables to drizzle/schema.ts
- [x] Add DB helper functions to server/db.ts (sha256, jobQueryHash, getJobCache, setJobCache, getJobWatchList, setJobWatchList, getTldrCache, setTldrCache)
- [x] Run pnpm db:push to sync schema to database

## tRPC Router (server/routers.ts)

- [x] Add `jobs.getWatchList` procedure (read watch list from DB)
- [x] Add `jobs.setWatchList` procedure (persist watch list to DB)
- [x] Add `jobs.refresh` procedure (manual-only refresh with payload hash change detection)
- [x] Add `jobs.getCached` procedure (read cached result without triggering fetch)
- [x] Add `tldr.getArticles` procedure (DB cache, 4h TTL)
- [x] Add `tldr.refresh` procedure (force-refresh regardless of cache age)
- [x] Add `inspo.getItems` procedure (proxy to getInspoItems())
- [x] Add `companies.search` procedure (proxy to searchCompanies())

## Job Board — Manual-Only Refresh

- [x] Remove auto-fetch on mount from jobStore.ts (useEffect calling refresh())
- [x] Load cached jobs from DB on mount via trpc.jobs.getCached (no API call)
- [x] Manual refresh only via trpc.jobs.refresh mutation (user clicks Refresh button)
- [x] Implement payload hash change detection: skip Claude if raw postings unchanged

## Job Search Relevance Fix

- [x] Change mentionsAnyMustWord() to check job TITLE only (not description)
- [x] Update Claude prompt to clarify title-first evaluation and stricter rejection criteria
- [x] Root cause: description-based pre-filter was matching "design" in boilerplate text (e.g. "collaborate with design and engineering"), letting unrelated SE roles through

## Client Store Migration (REST → tRPC)

- [x] Migrate jobStore.ts: use trpc.jobs.getCached + trpc.jobs.refresh
- [x] Migrate jobWatchStore.ts: sync to DB via trpc.jobs.getWatchList/setWatchList
- [x] Migrate tldrStore.ts: use trpc.tldr.getArticles + trpc.tldr.refresh
- [x] Migrate inspoStore.ts: use trpc.inspo.getItems
- [x] Migrate JobWatchList.tsx company search: use trpc.companies.search

## Vite Config Cleanup

- [x] Remove vitePluginTldrArticlesProxy (replaced by tRPC)
- [x] Remove vitePluginDesignInspoProxy (replaced by tRPC)
- [x] Remove vitePluginJobsProxy (replaced by tRPC)
- [x] Remove vitePluginCompanySearchProxy (replaced by tRPC)
- [x] Remove server-side imports (getFeedArticles, getInspoItems, getLiveJobs, searchCompanies) from vite.config.ts

## GitHub

- [x] Pull latest changes from GitHub before starting work
- [x] Commit and push all changes to GitHub

## Job Board — Expanded ATS Coverage + Custom Careers Pages

- [x] Add Lever ATS support (fetchLeverJobs via api.lever.co/v0/postings/{slug}?mode=json)
- [x] Add agent-driven careers URL discovery: when all ATS attempts fail, Claude resolves the real careers URL from the company domain (tries common paths, then falls back to a search-style prompt)
- [x] Cache discovered careers URLs per domain so the agent only runs once per company
- [x] Add HTML scrape fallback: fetch the discovered careers URL, extract job title+link pairs with DOM parsing
- [x] Update KNOWN_ATS: add Lever entries for companies known to use it (e.g. Discord)
- [x] Extend fetchCompanyJobsUncached to try Lever before HTML scrape
