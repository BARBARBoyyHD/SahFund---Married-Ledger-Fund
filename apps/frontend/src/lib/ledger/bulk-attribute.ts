import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "../db/index.ts";
import { members, transactions } from "../db/schema.ts";

/**
 * US-24: attribute a selection of transactions to one member in one action. The caller
 * (route handler) has already checked membership; this module only touches rows of this
 * workspace and answers per id: `updated` vs `notFound` (unknown or foreign) — a silent
 * partial success is never acceptable (spec: No silent partial success).
 *
 * D1 has no interactive transactions and a batch is all-or-nothing, so "which rows
 * updated" is answered by validating the ids first and updating exactly the found ones;
 * one UPDATE then changes all of them or none (AGENTS §2).
 */

export const bulkAttributeSchema = z.object({
  ids: z
    .array(
      z.string({ error: "Pilihan tidak valid." }).trim().min(1, "Pilihan tidak valid.").max(64, "Pilihan tidak valid."),
      { error: "Pilih transaksi yang akan ditandai." },
    )
    .min(1, "Pilih minimal satu transaksi.")
    .max(500, "Maksimal 500 transaksi per tindakan.")
    // A repeated id is one row with one outcome, not two lines in the report.
    .transform((ids) => [...new Set(ids)]),
  /** Empty/omitted clears the attribution; a non-empty id must be a member of this workspace. */
  memberId: z
    .string({ error: "Pilihan tidak valid." })
    .trim()
    .max(64, "Pilihan tidak valid.")
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
});

export type BulkAttributeData = z.output<typeof bulkAttributeSchema>;

export type BulkAttributeResult =
  | { ok: true; updated: string[]; notFound: string[] }
  | { ok: false; reason: "unknown-reference" };

export async function bulkAttributeTransactions(
  db: Db,
  workspaceId: string,
  data: BulkAttributeData,
): Promise<BulkAttributeResult> {
  // The FK cannot express tenancy; a foreign member id would label our rows with another
  // couple's name. Same rule as manual entry (lib/ledger/service.ts).
  if (data.memberId !== null) {
    const [member] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, data.memberId), eq(members.workspaceId, workspaceId)))
      .limit(1);
    if (!member) return { ok: false, reason: "unknown-reference" };
  }

  // Validate first: this read is the per-row answer, not a check-then-act invariant — the
  // UPDATE below is itself workspace-scoped, so a wrong answer could only cost a 404 line.
  const found = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(eq(transactions.workspaceId, workspaceId), inArray(transactions.id, data.ids)),
    );

  const foundIds = new Set(found.map((row) => row.id));
  const updated = data.ids.filter((id) => foundIds.has(id));
  const notFound = data.ids.filter((id) => !foundIds.has(id));

  if (updated.length > 0) {
    await db
      .update(transactions)
      .set({ memberId: data.memberId })
      .where(
        and(eq(transactions.workspaceId, workspaceId), inArray(transactions.id, updated)),
      );
  }

  return { ok: true, updated, notFound };
}
