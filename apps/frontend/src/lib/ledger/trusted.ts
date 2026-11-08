import { and, eq, isNull, notInArray, or, type SQL } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { imports, transactions } from "../db/schema.ts";

/**
 * US-17: a flagged import (`reconciled = false`) counts toward trusted totals only
 * after the user explicitly confirms it. Every aggregate that shows money must filter
 * on this condition — a failed import is never silently mixed into a report.
 *
 * The ledger *list* does not use it: those rows are shown, marked "belum cocok", and
 * become trustworthy the moment the import is confirmed.
 *
 * One extra scoped read per render, then the condition joins the existing aggregate
 * queries (no per-row subquery, no N+1).
 */
export async function trustedTotalsCondition(db: Db, workspaceId: string): Promise<SQL | undefined> {
  const flagged = await db
    .select({ id: imports.id })
    .from(imports)
    .where(
      and(
        eq(imports.workspaceId, workspaceId),
        eq(imports.reconciled, false),
        isNull(imports.confirmedAt),
      ),
    );

  if (flagged.length === 0) return undefined;

  // Manual rows have no import (NULL) and always count. `notInArray` alone would drop
  // them: SQL's three-valued logic makes `NULL NOT IN (...)` unknown, not true.
  return or(
    isNull(transactions.importId),
    notInArray(
      transactions.importId,
      flagged.map((row) => row.id),
    ),
  );
}
