import fs from "node:fs";
import path from "node:path";

export const CACHE_DIR = path.resolve(process.cwd(), ".cache");

export function loadJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

export function saveJson(file: string, data: unknown) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {
    // best-effort — a cache write failure just means we redo the work next time
  }
}

// Simple string hash used to derive stable ids from URLs across all scraped
// feeds, so read-state/dedup keyed by id survives across refetches.
export function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    // Some sources (e.g. Substack) use decimal/hex numeric entities for curly
    // quotes/dashes (e.g. &#8220; “, &#8217; ’, &#8212; —) — decode generically.
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
