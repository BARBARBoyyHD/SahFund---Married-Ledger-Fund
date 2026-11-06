import { and, eq } from "drizzle-orm";

import { dedupeHash } from "../../core/dedupe.ts";
import { classifyError, type Db } from "../db/index.ts";
import { categories, members, transactions } from "../db/schema.ts";
import type { CreateManualTransactionData } from "./schema.ts";

export type CreateManualTransactionResult =
  | { ok: true; id: string }
  | { ok: false; reason: "conflict" | "unknown-reference" };

/**
 * US-21: one manual row, `source = 'manual'`, no import. Both members share the ledger,
 * so there is no owner check. The unique index on `(workspaceId, dedupeHash)` is the
 * source of truth for duplicates; this function only maps its violation to a reason.
 */
export async function createManualTransaction(
  db: Db,
  workspaceId: string,
  data: CreateManualTransactionData,
): Promise<CreateManualTransactionResult> {
  // A chosen foreign key must belong to *this* workspace, not merely exist: the FK alone
  // cannot express that, and a cross-workspace id would leak another couple's label.
  if (data.categoryId !== null) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.workspaceId, workspaceId)))
      .limit(1);
    if (!category) return { ok: false, reason: "unknown-reference" };
  }

  if (data.memberId !== null) {
    const [member] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, data.memberId), eq(members.workspaceId, workspaceId)))
      .limit(1);
    if (!member) return { ok: false, reason: "unknown-reference" };
  }

  const id = crypto.randomUUID();

  try {
    await db.insert(transactions).values({
      id,
      workspaceId,
      categoryId: data.categoryId,
      memberId: data.memberId,
      occurredOn: data.occurredOn,
      description: data.description,
      amountMinor: BigInt(data.amountMinor),
      // Manual rows have no printed bank balance (ERD §6 is silent); the column is NOT
      // NULL, so 0 means "not applicable" and no screen renders it as a balance.
      balanceMinor: BigInt(0),
      direction: data.direction,
      source: "manual",
      // shortcut: manual rows pass empty time/ref and balance 0, so two manual rows with
      // the same date + amount collide even when the descriptions differ. That is the
      // pinned tuple (ERD §5 / ITA §5); upgrade when manual rows must be distinguishable.
      dedupeHash: dedupeHash({
        workspaceId,
        date: data.occurredOn,
        time: "",
        amountMinor: data.amountMinor,
        balanceMinor: 0,
        ref: "",
      }),
    });
  } catch (error) {
    const violation = classifyError(error);
    if (violation?.table === "transactions" && violation.columns.includes("dedupeHash")) {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }

  return { ok: true, id };
}
