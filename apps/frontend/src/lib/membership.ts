import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { unauthenticated, unavailable } from "@/lib/http";
import { getSession } from "@/lib/session";

/** The caller's membership in one workspace, or why there is none (design D11). */
type Access =
  | { kind: "member"; userId: string; role: string }
  | { kind: "unauthenticated" }
  | { kind: "not-a-member" };

/**
 * The one membership read: session → the caller's row in *this* workspace (AGENTS §4).
 * A URL id is never enough, and a missing row and a missing workspace answer alike,
 * so nothing discloses whether the workspace exists.
 */
async function readMembership(workspaceId: string): Promise<Access> {
  const session = await getSession();
  if (!session) return { kind: "unauthenticated" };

  const [row] = await getDb()
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, session.user.id)))
    .limit(1);

  return row ? { kind: "member", userId: session.user.id, role: row.role } : { kind: "not-a-member" };
}

/**
 * For server components: signed out → `/login`, not a member → not-found. Neither path
 * renders a workspace row. `proxy.ts` is convenience only; this is the boundary (§9).
 */
export async function requireMembership(workspaceId: string) {
  const access = await readMembership(workspaceId);

  if (access.kind === "unauthenticated") redirect("/login");
  if (access.kind === "not-a-member") notFound();

  return access;
}

export type ApiMembership = { ok: true; userId: string; role: string } | { ok: false; response: NextResponse };

/**
 * For route handlers: 401 when signed out, 404 when not a member — a redirect from an
 * API route would be a lie about what happened (src/lib/session.ts). The guard returns
 * the caller's role for the handler's own owner checks; it never returns a row.
 */
export async function membershipForApi(workspaceId: string): Promise<ApiMembership> {
  try {
    const access = await readMembership(workspaceId);

    if (access.kind === "member") return { ok: true, userId: access.userId, role: access.role };
    if (access.kind === "unauthenticated") return { ok: false, response: unauthenticated() };

    return {
      ok: false,
      response: NextResponse.json({ message: "Workspace tidak ditemukan." }, { status: 404 }),
    };
  } catch (error) {
    // A dead database is an explicit 503 with a retry message, never a blank response (§8).
    console.error("[membership] read failed", {
      status: 503,
      cause: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, response: unavailable() };
  }
}
