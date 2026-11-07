import { count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { ACCOUNT_CONFIRM, ACCOUNT_WORKSPACE_PATH } from "./account-contract.ts";
import type { Db } from "./db/index.ts";
import {
  account,
  categories,
  commitments,
  entitlementGrants,
  imports,
  members,
  payeeRules,
  rateLimits,
  session,
  shareTokens,
  transactions,
  user,
  verification,
  workspaces,
} from "./db/schema.ts";

/**
 * US-39/US-40 (BRD FR-12, NFR-06): deletion is one `db.batch()` per action — D1 has no
 * interactive transactions (AGENTS §2), and a half-deleted workspace would leave money
 * rows nobody can see or erase. The statements below are the whole cascade; the handlers
 * only prove who is asking.
 *
 * Rate-limit keys are not foreign-keyed (rate_limits has no FK — the table must work
 * before a session exists), so they are deleted by the workspace-keyed strings the
 * limiter actually writes: `ws:<id>` (invite) and `imp:<id>` (import).
 */
function workspaceCascade(db: Db, workspaceId: string) {
  return [
    // transactions.importId is ON DELETE RESTRICT — the rows must leave before the
    // import they belong to, or the batch fails and nothing is deleted.
    db.delete(transactions).where(eq(transactions.workspaceId, workspaceId)),
    db.delete(imports).where(eq(imports.workspaceId, workspaceId)),
    db.delete(commitments).where(eq(commitments.workspaceId, workspaceId)),
    db.delete(payeeRules).where(eq(payeeRules.workspaceId, workspaceId)),
    db.delete(categories).where(eq(categories.workspaceId, workspaceId)),
    db.delete(members).where(eq(members.workspaceId, workspaceId)),
    db.delete(entitlementGrants).where(eq(entitlementGrants.workspaceId, workspaceId)),
    db.delete(shareTokens).where(eq(shareTokens.workspaceId, workspaceId)),
    db.delete(rateLimits).where(
      inArray(rateLimits.key, [`ws:${workspaceId}`, `imp:${workspaceId}`]),
    ),
    db.delete(workspaces).where(eq(workspaces.id, workspaceId)),
  ] as const;
}

/** US-39: the owner's cascade. The handler has already checked the caller's role. */
export async function deleteWorkspace(db: Db, workspaceId: string): Promise<void> {
  await db.batch(workspaceCascade(db, workspaceId));
}

export type OwnedWorkspace = { id: string; name: string; memberCount: number };

/**
 * US-40: what the account owns, read before the confirm screen so the path can be
 * stated (design Appendix B-5): a workspace alone is deleted with the account; one
 * with a second member needs the explicit choice.
 *
 * The count picks the confirmation copy — it is a UX gate, not a data invariant. A member
 * joining between this read and the delete is a race no constraint can close; the batch
 * still deletes exactly what the confirmed path says.
 */
export async function ownedWorkspace(db: Db, userId: string): Promise<OwnedWorkspace | null> {
  const [owned] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);

  if (!owned) return null;

  const [counted] = await db
    .select({ total: count() })
    .from(members)
    .where(eq(members.workspaceId, owned.id));

  return { ...owned, memberCount: Number(counted?.total ?? 0) };
}

/**
 * US-40: sessions, credentials and the user row go with the account, so sign-in stops
 * working immediately. An owned workspace is deleted with it (the only path v1.0 offers —
 * the handler requires an explicit confirmation when a second member shares it); a plain
 * membership in someone else's workspace is just removed.
 *
 * Returns the deleted workspace id (or null) so the caller can log it — never the email.
 */
export async function deleteAccount(
  db: Db,
  userId: string,
  email: string,
): Promise<{ workspaceId: string | null }> {
  const [owned] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);
  const workspaceId = owned?.id ?? null;

  // Membership in another owner's workspace (UNIQUE(members.userId) — at most one).
  const accountRows = [
    db.delete(members).where(eq(members.userId, userId)),
    db.delete(session).where(eq(session.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    // Better Auth keys pending verifications by the email, not by user id.
    db.delete(verification).where(eq(verification.identifier, email)),
    db.delete(user).where(eq(user.id, userId)),
  ] as const;

  if (workspaceId) {
    await db.batch([...workspaceCascade(db, workspaceId), ...accountRows]);
  } else {
    await db.batch(accountRows);
  }

  return { workspaceId };
}

/**
 * US-40: `confirm` is the deliberate second action the UI asks for; `workspacePath` is
 * the explicit statement required when the account owns a workspace with a second member
 * (design D4, Appendix B-5). `delete-with-it` is the only path implemented in v1.0 —
 * there is no ownership handover, so the server refuses to guess.
 */
export const deleteAccountSchema = z.object({
  confirm: z.literal(ACCOUNT_CONFIRM, {
    error: `Ketik "${ACCOUNT_CONFIRM}" untuk mengonfirmasi.`,
  }),
  workspacePath: z
    .literal(ACCOUNT_WORKSPACE_PATH, { error: "Workspace hanya bisa dihapus bersama akun." })
    .optional(),
});

export type DeleteAccountData = z.infer<typeof deleteAccountSchema>;

export const ACCOUNT_MESSAGE = {
  /** US-40: the shared workspace must be acknowledged, not silently destroyed. */
  workspacePathRequired:
    "Akun ini pemilik workspace yang punya anggota lain. Konfirmasikan bahwa workspace ikut dihapus sebelum melanjutkan.",
  deleted: "Akun dan seluruh datanya sudah dihapus.",
} as const;
