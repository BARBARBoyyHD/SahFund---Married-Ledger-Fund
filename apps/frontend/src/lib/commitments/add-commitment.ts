import { and, eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { categories, commitments } from "../db/schema.ts";
import type { CreateCommitmentData } from "./commitment-schema.ts";

export type CreateCommitmentResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unknown-reference" };

/**
 * US-28 / BRD FR-09: a vendor contract is stored independently of the ledger. Any member
 * may add one (shared ledger, no owner check). One insert — commitments are one table.
 */
export async function createCommitment(
  db: Db,
  workspaceId: string,
  data: CreateCommitmentData,
): Promise<CreateCommitmentResult> {
  // A chosen category must belong to this workspace: the FK cannot express tenancy, and
  // a cross-workspace id would surface another couple's category name in the list.
  if (data.categoryId !== null) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.workspaceId, workspaceId)))
      .limit(1);
    if (!category) return { ok: false, reason: "unknown-reference" };
  }

  const id = crypto.randomUUID();

  await db.insert(commitments).values({
    id,
    workspaceId,
    vendor: data.vendor,
    categoryId: data.categoryId,
    totalMinor: BigInt(data.totalMinor),
    paidMinor: BigInt(data.paidMinor),
    dueOn: data.dueOn,
    status: data.status,
  });

  return { ok: true, id };
}
