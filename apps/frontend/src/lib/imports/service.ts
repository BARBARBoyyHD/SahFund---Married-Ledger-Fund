import { and, eq, isNull } from "drizzle-orm";

import { dedupeHash } from "../../core/dedupe.ts";
import { reconcile, type Reconciliation } from "../../core/reconcile.ts";
import { IMPORT_LIMIT, allowAttempt } from "../auth/rate-limit.ts";
import type { Db } from "../db/index.ts";
import { imports, transactions } from "../db/schema.ts";
import type { ImportStatementData } from "./schema.ts";

/**
 * The import writes (US-12/US-13/US-16). Route handlers stay orchestration; the
 * atomicity rules live here:
 *
 * - The server re-runs `core/reconcile.ts` on the posted rows and stores *its* verdict;
 *   the client's `reconciliation` field is advisory and never read (AGENTS §3).
 * - Import row + every transaction row leave in ONE `db.batch()` (AGENTS §2) — no
 *   `db.transaction()`, D1 has none.
 * - Duplicates are dropped by `UNIQUE (workspaceId, dedupeHash)`, not by a prior read:
 *   `ON CONFLICT DO NOTHING` makes a re-import a no-op and lets two overlapping imports
 *   both succeed (AGENTS §3).
 */

export type CommitImportResult =
  | {
      ok: true;
      importId: string;
      /** Rows the unique index actually stored. */
      inserted: number;
      /** Posted rows the index dropped as already present. */
      duplicates: number;
      reconciliation: Reconciliation;
    }
  | { ok: false; reason: "rate-limited" };

export async function commitImport(
  db: Db,
  workspaceId: string,
  data: ImportStatementData,
): Promise<CommitImportResult> {
  // NFR-02: 20 imports/hour/workspace, spent before any row is written. A distinct key
  // from the invite limit so the two budgets never consume each other.
  if (!(await allowAttempt(db, `ws:import:${workspaceId}`, IMPORT_LIMIT))) {
    return { ok: false, reason: "rate-limited" };
  }

  const reconciliation = reconcile({
    name: data.pocketName,
    openingBalanceMinor: data.openingBalanceMinor,
    totalInMinor: data.totalInMinor,
    totalOutMinor: data.totalOutMinor,
    closingBalanceMinor: data.closingBalanceMinor,
    transactions: data.transactions,
  });

  const importId = crypto.randomUUID();
  const rows = data.transactions.map((tx) => ({
    id: crypto.randomUUID(),
    workspaceId,
    importId,
    occurredOn: tx.date,
    description: tx.description,
    amountMinor: BigInt(tx.amountMinor),
    balanceMinor: BigInt(tx.balanceMinor),
    direction: tx.direction,
    ref: tx.ref === "" ? null : tx.ref,
    source: data.sourceId,
    // The one dedupe implementation (AGENTS §7), computed app-side (rule P6).
    dedupeHash: dedupeHash({
      workspaceId,
      date: tx.date,
      time: tx.time,
      amountMinor: tx.amountMinor,
      balanceMinor: tx.balanceMinor,
      ref: tx.ref,
    }),
  }));

  // `txCount` is the number of rows this upload carried: the index — not this
  // function — decides how many are new, and a batch cannot read its own results.
  const results = await db.batch([
    db
      .insert(imports)
      .values({
        id: importId,
        workspaceId,
        sourceId: data.sourceId,
        period: data.period,
        pocketName: data.pocketName,
        txCount: rows.length,
        reconciled: reconciliation.ok,
        issues: reconciliation.issues,
      })
      .returning({ id: imports.id }),
    ...rows.map((row) =>
      db
        .insert(transactions)
        .values(row)
        .onConflictDoNothing({ target: [transactions.workspaceId, transactions.dedupeHash] })
        .returning({ id: transactions.id }),
    ),
  ]);

  const inserted = results
    .slice(1)
    .reduce((total, stored) => total + stored.length, 0);

  return {
    ok: true,
    importId,
    inserted,
    duplicates: rows.length - inserted,
    reconciliation,
  };
}

/**
 * US-17: an explicit confirmation of a flagged import. A single-row write — the flag
 * is the whole state — and workspace-scoped, so an id from the URL is never enough
 * (AGENTS §4). Returns false when there is nothing to confirm (wrong workspace,
 * already trusted, or already confirmed).
 */
export async function confirmImport(db: Db, workspaceId: string, importId: string): Promise<boolean> {
  const confirmed = await db
    .update(imports)
    .set({ confirmedAt: new Date() })
    .where(
      and(
        eq(imports.id, importId),
        eq(imports.workspaceId, workspaceId),
        eq(imports.reconciled, false),
        isNull(imports.confirmedAt),
      ),
    )
    .returning({ id: imports.id });

  return confirmed.length > 0;
}
