import { eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { entitlementGrants, imports } from "../db/schema.ts";
import { ENTITLEMENT_MESSAGE } from "./messages.ts";

/** Allowed, or refused with the one unlock message the UI renders verbatim. */
export type Gate = { ok: true } | { ok: false; message: string };

/**
 * The single entitlement rule (design D1/D2): a workspace is paid when at least one
 * grant row exists. Scoped by workspace, one point lookup on the workspace index.
 */
export async function hasPaidAccess(db: Db, workspaceId: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: entitlementGrants.id })
    .from(entitlementGrants)
    .where(eq(entitlementGrants.workspaceId, workspaceId))
    .limit(1);

  return Boolean(grant);
}

/**
 * US-35: the first import is free. "First" is defined by the absence of any import
 * row for the workspace — the same rows the dashboard reads, so the free state can
 * never disagree with what the user sees. Every later import needs a grant.
 */
export async function importGate(db: Db, workspaceId: string): Promise<Gate> {
  if (await hasPaidAccess(db, workspaceId)) return { ok: true };

  const [priorImport] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(eq(imports.workspaceId, workspaceId))
    .limit(1);

  return priorImport ? { ok: false, message: ENTITLEMENT_MESSAGE.locked } : { ok: true };
}

/** US-38: export is paid-only — even a workspace that has imported nothing. */
export async function exportGate(db: Db, workspaceId: string): Promise<Gate> {
  return (await hasPaidAccess(db, workspaceId))
    ? { ok: true }
    : { ok: false, message: ENTITLEMENT_MESSAGE.locked };
}
