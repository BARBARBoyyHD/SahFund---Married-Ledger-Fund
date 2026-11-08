import { and, eq, isNotNull } from "drizzle-orm";

import { dedupeHash } from "../../core/dedupe.ts";
import { classifyError, type Db } from "../db/index.ts";
import { categories, members, transactions } from "../db/schema.ts";
import type {
  CreateManualTransactionData,
  UpdateTransactionClassificationData,
} from "./schema.ts";

export type CreateManualTransactionResult =
  | { ok: true; id: string }
  | { ok: false; reason: "conflict" | "unknown-reference" };

export type UpdateTransactionResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "unknown-reference" | "not-found" };

/** The row facts an update needs: which branch it takes, and the immutable hash parts. */
export type TransactionTarget = {
  importId: string | null;
  balanceMinor: bigint;
  ref: string | null;
};

/**
 * A chosen foreign key must belong to *this* workspace, not merely exist: the FK alone
 * cannot express that, and a cross-workspace id would leak another couple's label.
 * Shared by create and both update branches.
 */
async function hasUnknownReference(
  db: Db,
  workspaceId: string,
  categoryId: string | null | undefined,
  memberId: string | null | undefined,
): Promise<boolean> {
  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.workspaceId, workspaceId)))
      .limit(1);
    if (!category) return true;
  }

  if (memberId) {
    const [member] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, memberId), eq(members.workspaceId, workspaceId)))
      .limit(1);
    if (!member) return true;
  }

  return false;
}

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
  if (await hasUnknownReference(db, workspaceId, data.categoryId, data.memberId)) {
    return { ok: false, reason: "unknown-reference" };
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

/** The row an edit targets, scoped by workspace. `null` means it is not ours. */
export async function readTransactionTarget(
  db: Db,
  workspaceId: string,
  txId: string,
): Promise<TransactionTarget | null> {
  const [row] = await db
    .select({
      importId: transactions.importId,
      balanceMinor: transactions.balanceMinor,
      ref: transactions.ref,
    })
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.workspaceId, workspaceId)))
    .limit(1);

  return row ?? null;
}

/**
 * Full edit of a manual row. `dedupeHash` is derived from date + amount, so changing
 * either must recompute it through the one core function; `source = 'manual'` in the
 * WHERE keeps an imported row's statement facts out of reach. The update itself is the
 * concurrency guard — no read-then-decide here.
 */
export async function updateManualTransaction(
  db: Db,
  workspaceId: string,
  txId: string,
  data: CreateManualTransactionData,
  current: TransactionTarget,
): Promise<UpdateTransactionResult> {
  if (await hasUnknownReference(db, workspaceId, data.categoryId, data.memberId)) {
    return { ok: false, reason: "unknown-reference" };
  }

  try {
    const rows = await db
      .update(transactions)
      .set({
        occurredOn: data.occurredOn,
        description: data.description,
        amountMinor: BigInt(data.amountMinor),
        direction: data.direction,
        categoryId: data.categoryId,
        memberId: data.memberId,
        dedupeHash: dedupeHash({
          workspaceId,
          date: data.occurredOn,
          // Manual rows are inserted with an empty time; only the date/amount change.
          time: "",
          amountMinor: data.amountMinor,
          balanceMinor: Number(current.balanceMinor),
          ref: current.ref ?? "",
        }),
      })
      .where(
        and(
          eq(transactions.id, txId),
          eq(transactions.workspaceId, workspaceId),
          eq(transactions.source, "manual"),
        ),
      )
      .returning({ id: transactions.id });

    return rows.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  } catch (error) {
    const violation = classifyError(error);
    if (violation?.table === "transactions" && violation.columns.includes("dedupeHash")) {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }
}

/**
 * US-20 re-categorise: imported amounts and dates are statement facts, so only the
 * classification columns may change. An omitted field is left untouched; `null` clears.
 */
export async function updateTransactionClassification(
  db: Db,
  workspaceId: string,
  txId: string,
  data: UpdateTransactionClassificationData,
): Promise<UpdateTransactionResult> {
  const set: { categoryId?: string | null; memberId?: string | null } = {};
  if (data.categoryId !== undefined) set.categoryId = data.categoryId;
  if (data.memberId !== undefined) set.memberId = data.memberId;
  if (Object.keys(set).length === 0) return { ok: true };

  if (await hasUnknownReference(db, workspaceId, data.categoryId, data.memberId)) {
    return { ok: false, reason: "unknown-reference" };
  }

  const rows = await db
    .update(transactions)
    .set(set)
    .where(
      and(
        eq(transactions.id, txId),
        eq(transactions.workspaceId, workspaceId),
        isNotNull(transactions.importId),
      ),
    )
    .returning({ id: transactions.id });

  return rows.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}

/** One DELETE, scoped by workspace; the returned row proves it belonged to the caller. */
export async function deleteTransaction(db: Db, workspaceId: string, txId: string) {
  const rows = await db
    .delete(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.workspaceId, workspaceId)))
    .returning({ id: transactions.id });

  return rows.length > 0;
}

