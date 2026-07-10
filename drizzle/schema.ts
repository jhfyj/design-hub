import { bigint, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Persisted job board cache.
 *
 * One row per unique (companies + mustTags + relevantTags) combination,
 * keyed by a SHA-256 hash of those three inputs. On every manual Refresh:
 *  1. Fetch raw postings from Greenhouse/Ashby.
 *  2. Hash the raw payload.
 *  3. If payloadHash matches storedPayloadHash → return cachedJobs, skip Claude.
 *  4. Otherwise run the full filter+recommend pipeline, update this row.
 */
export const jobCache = mysqlTable("job_cache", {
  id: int("id").autoincrement().primaryKey(),
  /** SHA-256 of sorted(companies + mustTags + relevantTags) — the query key */
  queryHash: varchar("queryHash", { length: 64 }).notNull().unique(),
  /** SHA-256 of the raw Greenhouse/Ashby payload — change-detection */
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  /** Full getLiveJobs() result: { jobs, recommended } */
  cachedJobs: json("cachedJobs").notNull(),
  fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
});

export type JobCache = typeof jobCache.$inferSelect;

/**
 * Persisted job watch list (companies + tags).
 * Single-user app: one row with id=1.
 */
export const jobWatchList = mysqlTable("job_watch_list", {
  id: int("id").autoincrement().primaryKey(),
  companies: json("companies").notNull(),
  mustTags: json("mustTags").notNull(),
  relevantTags: json("relevantTags").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobWatchList = typeof jobWatchList.$inferSelect;

/**
 * TLDR feed cache — same hash+blob pattern as job_cache.
 * Prevents redundant Claude summarisation calls when the feed hasn't changed.
 */
export const tldrCache = mysqlTable("tldr_cache", {
  id: int("id").autoincrement().primaryKey(),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  cachedArticles: json("cachedArticles").notNull(),
  fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
});

export type TldrCache = typeof tldrCache.$inferSelect;