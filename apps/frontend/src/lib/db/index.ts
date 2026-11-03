import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | undefined;

/**
 * Lazily created neon-http client — one client for the app, created on first
 * use so a missing DATABASE_URL fails at request time, not at build time.
 * No pool and no interactive transactions on this driver (AGENTS.md §2).
 */
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/** One cheap round trip, bounded so a hung database cannot hang the probe. */
export async function probeDb() {
  await getSql().query("select 1", [], {
    fetchOptions: { signal: AbortSignal.timeout(3000) },
  });
}
