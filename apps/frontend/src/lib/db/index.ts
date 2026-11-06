import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

declare global {
  interface CloudflareEnv {
    /** D1 binding declared in wrangler.jsonc — configuration, not a secret. */
    DB?: unknown;
  }
}

export type Db = DrizzleD1Database<typeof schema>;

let db: Db | undefined;

/**
 * Lazily created D1 client — one client for the app, created on first use so a
 * missing binding fails at request time, not at build time (ITA §2).
 *
 * This is the only module that imports the driver (portability rule P3): a
 * future database swap changes this file plus schema.ts, nothing else.
 * D1 has no interactive transactions — write with `db.batch()` (AGENTS §2).
 */
export function getDb(): Db {
  if (!db) {
    // SPEC §7.1: `wrangler types` will generate CloudflareEnv; until then `env.DB` is
    // `unknown`, so narrow it once here instead of casting at every call site.
    const binding = getCloudflareContext().env.DB as Parameters<typeof drizzle>[0] | undefined;
    if (!binding) throw new Error("D1 binding DB is not available");
    db = drizzle(binding, { schema });
  }
  return db;
}

/** One cheap round trip, bounded so a hung database cannot hang the probe. */
export async function probeDb() {
  const probe = getDb().run(sql`select 1`);
  // The probe may return before the query settles; its late rejection is not ours to report.
  probe.catch(() => {});
  await Promise.race([
    probe,
    new Promise((_, reject) => {
      // D1 calls accept no AbortSignal: the query keeps running, the probe returns 503.
      AbortSignal.timeout(3000).addEventListener("abort", () =>
        reject(new Error("D1 probe timed out")),
      );
    }),
  ]);
}

/** A violated unique index, as the handler needs it to pick its message (design D5). */
export type UniqueViolation = {
  kind: "unique";
  table: string;
  columns: string[];
};

const UNIQUE_PREFIX = "UNIQUE constraint failed: ";

/**
 * Rule P3: the only place in the app that reads driver error text. D1 reports
 * `UNIQUE constraint failed: <table>.<column>[, <table>.<column>]: SQLITE_CONSTRAINT`
 * (extended code `SQLITE_CONSTRAINT_UNIQUE`); anything else — CHECK, FK, a plain
 * Error — returns `null`. Handlers map this result to a Bahasa Indonesia message;
 * a `SQLITE_CONSTRAINT` string match anywhere else is a defect.
 */
export function classifyError(error: unknown): UniqueViolation | null {
  const message = driverMessage(error);
  const start = message.indexOf(UNIQUE_PREFIX);
  if (start < 0) return null;

  // Columns are comma-separated; D1 appends `: SQLITE_CONSTRAINT` after them.
  const pairs = message
    .slice(start + UNIQUE_PREFIX.length)
    .split(":")[0]
    .split(",")
    .map((part) => part.trim().split("."));

  const table = pairs[0]?.[0];
  const columns = pairs.map((pair) => pair[1]).filter((column): column is string => Boolean(column));
  if (!table || columns.length === 0) return null;

  return { kind: "unique", table, columns };
}

/** Drizzle wraps driver errors, so D1's message lives on `cause` (see the integration tests). */
function driverMessage(error: unknown): string {
  const cause = (error as { cause?: { message?: unknown } } | null)?.cause;
  if (typeof cause?.message === "string") return cause.message;
  return error instanceof Error ? error.message : "";
}
