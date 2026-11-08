import { classifyError, type Db } from "../db/index.ts";
import { entitlementGrants } from "../db/schema.ts";
import type { GrantEntitlementData } from "./schema.ts";

export type GrantResult = { ok: true; alreadyGranted: boolean };

/**
 * US-37: write the one entitlement row for a completed purchase. Idempotency is the
 * unique index on `orderId`, not a read-then-insert (AGENTS §3): a retried webhook or
 * a duplicate grant fails the index and becomes a no-op — never a second unlock.
 *
 * One `db.batch()` even for a single statement (AGENTS §2, design D1): a failed
 * insert leaves the workspace in its previous state, and the error is rethrown so
 * the handler surfaces a 503 instead of pretending the purchase landed.
 */
export async function grantEntitlement(db: Db, data: GrantEntitlementData): Promise<GrantResult> {
  try {
    await db.batch([
      db.insert(entitlementGrants).values({
        workspaceId: data.workspaceId,
        orderId: data.orderId,
      }),
    ]);
    return { ok: true, alreadyGranted: false };
  } catch (error) {
    const violation = classifyError(error);
    if (violation?.table === "entitlement_grants" && violation.columns.includes("orderId")) {
      return { ok: true, alreadyGranted: true };
    }
    throw error;
  }
}
