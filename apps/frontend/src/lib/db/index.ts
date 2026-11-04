import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

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
    const binding = getCloudflareContext().env.DB;
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
