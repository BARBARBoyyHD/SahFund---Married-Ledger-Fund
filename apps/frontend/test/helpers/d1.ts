import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { getPlatformProxy } from "wrangler";
import * as schema from "../../src/lib/db/schema.ts";

/**
 * Local-D1 integration harness (SPEC-d1-migration §9, T7).
 *
 * Runs the real SQLite engine D1 uses (workerd) with no Cloudflare account, no
 * network and no persisted state: `getPlatformProxy` reads `wrangler.jsonc` — the
 * same config the app and `wrangler dev` use — and boots an in-memory database.
 * Migrations are the committed `drizzle/*.sql`, so the tests fail if a migration
 * is not committed (schema drift is caught here as well as in CI).
 */

const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MIGRATIONS_DIR = join(PACKAGE_ROOT, "drizzle");

/** The slice of the D1 binding this harness needs — no `@cloudflare/workers-types` dep. */
export type D1Binding = {
  prepare(query: string): {
    run(): Promise<unknown>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  };
};

async function applyMigrations(binding: D1Binding) {
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // drizzle-kit separates statements with `--> statement-breakpoint`, and D1's
    // exec() runs one statement per line — so apply them one at a time.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await binding.prepare(statement).run();
  }
}

/** Boot an empty local D1, apply the committed migrations, hand back a Drizzle client. */
export async function startD1() {
  const proxy = await getPlatformProxy({
    configPath: join(PACKAGE_ROOT, "wrangler.jsonc"),
    persist: false, // in-memory: every run starts from an empty database
    remoteBindings: false, // never reach for the network (no Cloudflare auth in CI)
  });
  const binding = proxy.env.DB as D1Binding;
  await applyMigrations(binding);
  return {
    db: drizzle(proxy.env.DB as Parameters<typeof drizzle>[0], { schema }),
    binding,
    dispose: () => proxy.dispose(),
  };
}

/**
 * The 5,000-row import shape (BRD FR-03): one import row + N transaction rows in a
 * single `db.batch()`. This must run *inside* workerd — the platform proxy caps a
 * binding RPC message at roughly 2–3k statements (ECONNRESET), a transport limit
 * that does not exist for a Worker calling its own binding. So a throwaway Worker
 * runs the batch itself; the DDL still goes through the binding above.
 *
 * The Worker uses D1's own API rather than Drizzle because this test is about D1's
 * limits (statements per batch, 30 s batch duration, 100 KB per statement), not
 * about how Drizzle serializes — the atomicity tests cover that path.
 */
const BATCH_WORKER = `
export default {
  async fetch(request, env) {
    const rows = Number(new URL(request.url).searchParams.get("rows") ?? "5000");
    const statements = [
      env.DB.prepare(
        "insert into imports (id, workspaceId, sourceId, pocketName, txCount, reconciled, issues, createdAt) values (?, 'w1', 'jago', 'Dompet', ?, 1, '[]', 0)"
      ).bind("import-1", rows),
    ];
    for (let i = 0; i < rows; i++) {
      statements.push(
        env.DB.prepare(
          "insert into transactions (id, workspaceId, importId, occurredOn, description, amountMinor, balanceMinor, direction, source, dedupeHash) values (?, 'w1', 'import-1', '2026-11-01', ?, ?, ?, 'out', 'jago', ?)"
        ).bind("tx-" + i, "tx " + i, -1000 - i, 1000000 - i, "hash-" + i)
      );
    }
    const started = Date.now();
    await env.DB.batch(statements);
    return Response.json({ statements: statements.length, ms: Date.now() - started });
  },
};
`;

export async function runImportBatch(rows: number) {
  // shortcut: Miniflare v5's own options schema is still beta; the v4 shim keeps this
  // readable. Revisit when the v5 options API settles.
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: BATCH_WORKER,
      d1Databases: ["DB"],
      d1Persist: false,
      compatibilityDate: "2026-11-04", // must match wrangler.jsonc
    }),
  );
  try {
    const binding = (await mf.getD1Database("DB")) as unknown as D1Binding;
    await applyMigrations(binding);
    await binding.prepare("insert into workspaces (id, ownerId, name, inviteCode) values ('w1', 'u1', 'A', 'C1')").run();

    const response = await mf.dispatchFetch(`http://localhost/import?rows=${rows}`);
    if (!response.ok) throw new Error(`batch worker failed: ${response.status} ${await response.text()}`);
    const { statements, ms } = (await response.json()) as { statements: number; ms: number };

    const counted = await binding
      .prepare("select count(*) as n, sum(amountMinor) as total from transactions")
      .all<{ n: number; total: number }>();
    const imported = await binding
      .prepare("select txCount from imports where id = 'import-1'")
      .all<{ txCount: number }>();
    return {
      statements,
      ms,
      stored: counted.results[0].n,
      totalMinor: counted.results[0].total,
      txCount: imported.results[0]?.txCount,
    };
  } finally {
    await mf.dispose();
  }
}
