import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { getFeedArticles } from "./tldrFeed";
import { getInspoItems } from "./designInspoFeed";
import { getLiveJobs } from "./jobsFeed";

// Load .env if present (e.g. ANTHROPIC_API_KEY) — fine if it's missing,
// article selection just stays unconfigured (server/tldrFeed.ts errors clearly).
try { process.loadEnvFile(); } catch { /* no .env present */ }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Fetches TLDR Design + UX Collective, splits TLDR's multi-story digest
  // pages into individual articles, and uses one batched Anthropic call to
  // pick the most product-designer-relevant subset with need/means insight
  // for each (server/tldrFeed.ts). Dev-time equivalent lives in vite.config.ts.
  app.get("/api/tldr/articles", async (_req, res) => {
    try {
      const articles = await getFeedArticles();
      res.json(articles);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Feed fetch failed" });
    }
  });

  // Fetches Design Inspos board content from motion.dev + are.na
  // (server/designInspoFeed.ts). Dev-time equivalent lives in vite.config.ts.
  app.get("/api/design-inspo", async (_req, res) => {
    try {
      const items = await getInspoItems();
      res.json(items);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Feed fetch failed" });
    }
  });

  // Fetches live postings from each tracked company's public Greenhouse/
  // Ashby job board, hard-filtered to the "must include" role keywords, with
  // one batched Anthropic call picking the "Agent Recommended" subset by the
  // "relevant" tags (server/jobsFeed.ts). Dev-time equivalent lives in
  // vite.config.ts. Query params are comma-separated lists.
  app.get("/api/jobs", async (req, res) => {
    try {
      const companies = String(req.query.companies || "").split(",").map(s => s.trim()).filter(Boolean);
      const must = String(req.query.must || "").split(",").map(s => s.trim()).filter(Boolean);
      const relevant = String(req.query.relevant || "").split(",").map(s => s.trim()).filter(Boolean);
      const result = await getLiveJobs(companies, must, relevant);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Job feed fetch failed" });
    }
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
