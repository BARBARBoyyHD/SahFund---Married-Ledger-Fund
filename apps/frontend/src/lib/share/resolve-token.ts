import { eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { shareTokens } from "../db/schema.ts";
import { shareTokenState } from "./token.ts";

/**
 * BRD FR-11 / US-33: resolve a `/r/:token` link to the owning workspace, or `null` for
 * unknown, expired (`expiresAt <= now`) and revoked tokens — all three answer with the
 * same "link tidak tersedia" page, never an error dump. `now` is a parameter so the
 * decision is testable with an injected clock and a read never depends on which second
 * it happened to run on (ITA §4.1). No session: that is the point of the link.
 */
export async function resolveShareToken(
  db: Db,
  token: string,
  now: Date,
): Promise<string | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      workspaceId: shareTokens.workspaceId,
      expiresAt: shareTokens.expiresAt,
      revokedAt: shareTokens.revokedAt,
    })
    .from(shareTokens)
    .where(eq(shareTokens.token, token))
    .limit(1);

  if (!row || shareTokenState(row, now) !== "active") return null;
  return row.workspaceId;
}
