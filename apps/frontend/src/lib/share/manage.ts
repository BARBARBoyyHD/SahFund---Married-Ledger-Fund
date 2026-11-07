import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { shareTokens } from "../db/schema.ts";
import { generateShareToken, shareTokenExpiry } from "./token.ts";

export type CreatedShareToken = { id: string; token: string; expiresAt: Date };

/**
 * BRD FR-11 / US-32: one insert. The handler has already checked that the caller is the
 * workspace owner; a freak token collision violates the UNIQUE index and surfaces as the
 * ordinary 503 — the owner simply creates another link.
 */
export async function createShareToken(
  db: Db,
  workspaceId: string,
  now: Date,
): Promise<CreatedShareToken> {
  const id = crypto.randomUUID();
  const token = generateShareToken();
  const expiresAt = shareTokenExpiry(now);

  await db.insert(shareTokens).values({ id, workspaceId, token, expiresAt, createdAt: now });

  return { id, token, expiresAt };
}

/**
 * BRD FR-11 / US-34: revoke is a flag, not a delete — the owner still sees the link in
 * the list, and every resolve re-checks it, so revocation takes effect on the next
 * request for any holder of the URL. Workspace-scoped; `false` means not ours.
 */
export async function revokeShareToken(
  db: Db,
  workspaceId: string,
  shareId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(shareTokens)
    .set({ revokedAt: now })
    .where(and(eq(shareTokens.id, shareId), eq(shareTokens.workspaceId, workspaceId)))
    .returning({ id: shareTokens.id });

  return rows.length > 0;
}

/** Owner-facing list: newest first, bounded (share links are created by hand, not streamed). */
export async function listShareTokens(db: Db, workspaceId: string) {
  return db
    .select({
      id: shareTokens.id,
      token: shareTokens.token,
      expiresAt: shareTokens.expiresAt,
      createdAt: shareTokens.createdAt,
      revokedAt: shareTokens.revokedAt,
    })
    .from(shareTokens)
    .where(eq(shareTokens.workspaceId, workspaceId))
    .orderBy(desc(shareTokens.createdAt))
    .limit(50);
}
