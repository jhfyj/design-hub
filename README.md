# Design Hub

A personal design workspace — job board, TLDR design news, inspiration gallery, and project canvas.

---

## Running locally

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)

### 1. Clone and install

```bash
git clone https://github.com/jhfyj/design-hub.git
cd design-hub
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values. The table below explains each one and where to find it:

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | **Yes** | Manus project → Settings → Secrets |
| `JWT_SECRET` | **Yes** | Manus project → Settings → Secrets (or generate your own — see file) |
| `ANTHROPIC_API_KEY` | **Yes** | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `VITE_APP_ID` | For login | Manus project → Settings → Secrets |
| `OAUTH_SERVER_URL` | For login | Manus project → Settings → Secrets |
| `VITE_OAUTH_PORTAL_URL` | For login | Manus project → Settings → Secrets |
| `OWNER_OPEN_ID` | For admin role | Manus project → Settings → Secrets |
| `BUILT_IN_FORGE_*` | **Leave blank** | Manus-internal only — not usable outside Manus |
| `VITE_FRONTEND_FORGE_*` | **Leave blank** | Manus-internal only |

> **Login note:** Manus OAuth redirects back to `window.location.origin` after login. On localhost this is `http://localhost:3000`. You may need to add this as an allowed redirect URI in your Manus OAuth app settings. The app loads and most features work without being logged in.

### 3. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the database works

The database is a **shared cloud MySQL/TiDB instance** — not local. When you run locally, your server connects to the same database as the Manus-hosted preview via `DATABASE_URL`. Data you write locally (watch list, job cache) is visible on the Manus preview and vice versa.

To change the schema:

```bash
# Edit drizzle/schema.ts, then:
pnpm db:push
```

---

## Architecture

```
client/src/          Frontend (React 19 + Tailwind 4 + tRPC)
server/              Backend (Express + tRPC procedures)
server/_core/        Framework plumbing (OAuth, LLM, storage) — do not edit
drizzle/schema.ts    Database tables
server/db.ts         Query helpers
server/routers.ts    tRPC procedures
server/jobsFeed.ts   Job board: Greenhouse / Ashby / Lever + agent scrape fallback
server/tldrFeed.ts   TLDR design news feed + Claude summarisation
server/companySearch.ts  Company autocomplete (Clearbit)
```

### LLM behaviour

- **On Manus:** uses the built-in Forge proxy (`BUILT_IN_FORGE_API_KEY`) — no Anthropic key needed.
- **Locally:** automatically falls back to direct Anthropic API calls using `ANTHROPIC_API_KEY`. The response is normalized to the same shape so all callers work unchanged.

### Job board fetch strategy

For each watched company, the server tries in order:

1. **Known ATS** (pinned slug) — Greenhouse, Ashby, or Lever
2. **Slug guessing** — tries the company name against all three ATS APIs
3. **Agent URL discovery** — probes common URL patterns (`{domain}/careers`, etc.), then asks Claude Haiku if all probes fail. Cached per domain for 1 week.
4. **HTML scrape** — fetches the discovered careers page and extracts job links with a DOM parser

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start dev server (Express + Vite HMR) |
| `pnpm build` | Production build |
| `pnpm test` | Run Vitest unit tests |
| `pnpm db:push` | Generate + apply DB migrations |
| `pnpm check` | TypeScript type check |
