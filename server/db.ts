import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, jobCache, jobWatchList, tldrCache, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Hashing helpers ───────────────────────────────────────────────────────────

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable key for a job query: sorted companies + mustTags + relevantTags */
export function jobQueryHash(companies: string[], mustTags: string[], relevantTags: string[]): string {
  const key = JSON.stringify({
    c: [...companies].sort(),
    m: [...mustTags].sort(),
    r: [...relevantTags].sort(),
  });
  return sha256(key);
}

// ── Job cache helpers ─────────────────────────────────────────────────────────

export interface CachedJobResult {
  jobs: unknown[];
  recommended: unknown[];
}

export async function getJobCache(queryHash: string): Promise<{ payloadHash: string; result: CachedJobResult; fetchedAt: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(jobCache).where(eq(jobCache.queryHash, queryHash)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { payloadHash: row.payloadHash, result: row.cachedJobs as CachedJobResult, fetchedAt: row.fetchedAt };
}

export async function setJobCache(
  queryHash: string,
  payloadHash: string,
  result: CachedJobResult,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  await db
    .insert(jobCache)
    .values({ queryHash, payloadHash, cachedJobs: result, fetchedAt: now })
    .onDuplicateKeyUpdate({ set: { payloadHash, cachedJobs: result, fetchedAt: now } });
}

// ── Job watch list helpers ────────────────────────────────────────────────────

export interface WatchListData {
  companies: Array<{ id: number; name: string; url?: string; domain?: string }>;
  mustTags: string[];
  relevantTags: string[];
}

const WATCH_LIST_ID = 1;

export async function getJobWatchList(): Promise<WatchListData | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(jobWatchList).where(eq(jobWatchList.id, WATCH_LIST_ID)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    companies: row.companies as WatchListData["companies"],
    mustTags: row.mustTags as string[],
    relevantTags: row.relevantTags as string[],
  };
}

export async function setJobWatchList(data: WatchListData): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(jobWatchList)
    .values({ id: WATCH_LIST_ID, ...data })
    .onDuplicateKeyUpdate({ set: { companies: data.companies, mustTags: data.mustTags, relevantTags: data.relevantTags } });
}

// ── TLDR cache helpers ────────────────────────────────────────────────────────

export async function getTldrCache(): Promise<{ payloadHash: string; articles: unknown[]; fetchedAt: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(tldrCache).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { payloadHash: row.payloadHash, articles: row.cachedArticles as unknown[], fetchedAt: row.fetchedAt };
}

export async function setTldrCache(payloadHash: string, articles: unknown[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  await db
    .insert(tldrCache)
    .values({ id: 1, payloadHash, cachedArticles: articles, fetchedAt: now })
    .onDuplicateKeyUpdate({ set: { payloadHash, cachedArticles: articles, fetchedAt: now } });
}
