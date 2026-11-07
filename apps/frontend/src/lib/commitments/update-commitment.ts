import { and, eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { commitments } from "../db/schema.ts";
import type { UpdateCommitmentData } from "./commitment-schema.ts";

export type UpdateCommitmentResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * US-28: record a DP or a pelunasan against a contract. Status is derived in the shared
 * schema, never taken from the client; the UPDATE is workspace-scoped so a foreign id is
 * a 404, and `.returning` proves the row was ours (no read-then-write).
 */
export async function updateCommitment(
  db: Db,
  workspaceId: string,
  commitmentId: string,
  data: UpdateCommitmentData,
): Promise<UpdateCommitmentResult> {
  const changes: {
    totalMinor: bigint;
    paidMinor: bigint;
    status: string;
    dueOn?: string | null;
  } = {
    totalMinor: BigInt(data.totalMinor),
    paidMinor: BigInt(data.paidMinor),
    status: data.status,
  };
  // Omitted `dueOn` means "unchanged"; only an explicit value (or "") writes the column.
  if (data.dueOn !== undefined) changes.dueOn = data.dueOn;

  const rows = await db
    .update(commitments)
    .set(changes)
    .where(and(eq(commitments.id, commitmentId), eq(commitments.workspaceId, workspaceId)))
    .returning({ id: commitments.id });

  return rows.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}
