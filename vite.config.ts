import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { getFeedArticles } from "./server/tldrFeed";
import { getInspoItems } from "./server/designInspoFeed";
import { getLiveJobs } from "./server/jobsFeed";
import { searchCompanies } from "./server/companySearch";

// Vite doesn't load .env into process.env for server-side/plugin code (only
// import.meta.env for the client bundle) — load it explicitly so
// server/tldrFeed.ts can read ANTHROPIC_API_KEY. No .env is fine too;
// article selection just stays unconfigured (server/tldrFeed.ts errors clearly).
try { process.loadEnvFile(); } catch { /* no .env present */ }

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Fetches the TLDR Design + UX Collective newsletters, splits TLDR's
// multi-story digest pages into individual articles, and uses one batched
// Anthropic call to pick the most product-designer-relevant subset and write
// each one's "what you need to know"/"what it means to you" (server/tldrFeed.ts).
// No-ops with a clear error if ANTHROPIC_API_KEY isn't set — never fakes it.
function vitePluginTldrArticlesProxy(): Plugin {
  return {
    name: "design-hub-tldr-articles-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/tldr/articles", async (_req, res) => {
        try {
          const articles = await getFeedArticles();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(articles));
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Feed fetch failed" }));
        }
      });
    },
  };
}

// Fetches Design Inspos board content from motion.dev (a static animation
// example gallery) and are.na (public channels picked via channel search,
// since its old site-wide discovery endpoint was sunset) — see
// server/designInspoFeed.ts for the full source list and why other requested
// sources (Dribbble, Mobbin, styles.refero.design) aren't included yet.
function vitePluginDesignInspoProxy(): Plugin {
  return {
    name: "design-hub-inspo-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/design-inspo", async (_req, res) => {
        try {
          const items = await getInspoItems();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(items));
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Feed fetch failed" }));
        }
      });
    },
  };
}

// Fetches live postings from each tracked company's public Greenhouse/Ashby
// job board, filtered by the watch list's "must include"/"relevant" tags,
// with an Anthropic call picking the "Agent Recommended" subset
// (server/jobsFeed.ts). Falls back to a plain relevant-tag ranking if
// ANTHROPIC_API_KEY isn't set — the live-jobs feature itself never depends
// on it, unlike the TLDR feed above.
function vitePluginJobsProxy(): Plugin {
  return {
    name: "design-hub-jobs-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/jobs", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const companies = (url.searchParams.get("companies") || "").split(",").map(s => s.trim()).filter(Boolean);
          const must = (url.searchParams.get("must") || "").split(",").map(s => s.trim()).filter(Boolean);
          const relevant = (url.searchParams.get("relevant") || "").split(",").map(s => s.trim()).filter(Boolean);
          const result = await getLiveJobs(companies, must, relevant);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Job feed fetch failed" }));
        }
      });
    },
  };
}

// Company name/logo autocomplete for the Job Watch List's Add Company modal
// (server/companySearch.ts) — proxies Clearbit's public Autocomplete API so
// any company (not just a hardcoded list) is searchable.
function vitePluginCompanySearchProxy(): Plugin {
  return {
    name: "design-hub-company-search-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/company-search", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const results = await searchCompanies(url.searchParams.get("q") || "");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(results));
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Company search failed" }));
        }
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy(), vitePluginTldrArticlesProxy(), vitePluginDesignInspoProxy(), vitePluginJobsProxy(), vitePluginCompanySearchProxy()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
