import { getPlatformProxy, unstable_readConfig } from "wrangler";

import { getDb } from "../src/lib/db/index.ts";
import { categories, workspaces } from "../src/lib/db/schema.ts";
import { missingCategoryRows } from "../src/lib/workspace/wedding-category-seed.ts";

/**
 * Backfills the BRD FR-06 wedding categories into workspaces created before the seed
 * landed. Idempotent: only the names a workspace is missing are inserted, so a second
 * run writes nothing (UNIQUE(workspaceId, name) is the backstop).
 *
 * Writes to PRODUCTION by default — `wrangler.jsonc` marks the DB binding
 * `"remote": true`, and `getPlatformProxy` below mirrors that. Set `LOCAL_DB=1` to
 * target the isolated local Miniflare database instead:
 *
 *   npm run db:seed:categories            # remote sahfunddb
 *   LOCAL_DB=1 npm run db:seed:categories # local .wrangler/state
 *
 * Prints the target and summary counts only — never row contents (AGENTS §9).
 */

const CONFIG_PATH = "wrangler.jsonc";
const local = process.env.LOCAL_DB === "1";

async function main() {
  const config = unstable_readConfig({ config: CONFIG_PATH, hideWarnings: true });
  const databaseName = config.d1_databases[0]?.database_name ?? "DB";
  console.log(`target: ${databaseName} (${local ? "local" : "remote"})`);

  const proxy = await getPlatformProxy<{ DB: unknown }>({
    configPath: CONFIG_PATH,
    remoteBindings: !local,
  });

  try {
    const db = getDb(proxy.env.DB);

    // Two reads for the whole database, then group in memory — no per-workspace query.
    const workspaceRows = await db.select({ id: workspaces.id }).from(workspaces);
    const existingRows = await db
      .select({ workspaceId: categories.workspaceId, name: categories.name })
      .from(categories);

    const namesByWorkspace = new Map<string, string[]>();
    for (const row of existingRows) {
      const names = namesByWorkspace.get(row.workspaceId);
      if (names) names.push(row.name);
      else namesByWorkspace.set(row.workspaceId, [row.name]);
    }

    let inserted = 0;
    for (const workspace of workspaceRows) {
      const rows = missingCategoryRows(workspace.id, namesByWorkspace.get(workspace.id) ?? []);
      if (rows.length === 0) continue;
      await db.batch([db.insert(categories).values(rows)]);
      inserted += rows.length;
    }

    console.log(`workspaces scanned: ${workspaceRows.length}`);
    console.log(`categories inserted: ${inserted}`);
  } finally {
    await proxy.dispose();
  }
}

main().catch((error) => {
  // Name only: a driver error can echo bound values, and those are customer data.
  console.error("seed failed:", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
