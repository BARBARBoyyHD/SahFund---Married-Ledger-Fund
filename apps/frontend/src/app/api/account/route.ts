import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  ACCOUNT_MESSAGE,
  deleteAccount,
  deleteAccountSchema,
  ownedWorkspace,
} from "@/lib/deletion";
import { invalid, logFailure, logRoute, unavailable, unauthenticated } from "@/lib/http";
import { getSession } from "@/lib/session";

const ROUTE = "/api/account";

/**
 * US-40 (BRD FR-12, NFR-06): account deletion, in two steps so the owned-workspace path
 * is stated before anything is destroyed (design D4, Appendix B-5).
 *
 * GET is the pre-confirm read: the screen renders what the account owns (including a
 * second member) before asking. DELETE removes sessions, credentials, the user row, and
 * an owned workspace in one batch. With a second member the request is refused until the
 * body carries the explicit `workspacePath: "delete-with-it"` — v1.0 offers no handover,
 * so the server never guesses on the other member's behalf.
 *
 * The session cookie is not cleared server-side: its session row is gone, so the next
 * request reads no session. The client navigates to `redirectTo`.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthenticated();

    const owned = await ownedWorkspace(getDb(), session.user.id);
    return NextResponse.json({
      ownedWorkspace: owned && {
        id: owned.id,
        name: owned.name,
        memberCount: owned.memberCount,
        requiresExplicitPath: owned.memberCount > 1,
      },
    });
  } catch (error) {
    logFailure(`GET ${ROUTE}`, error);
    return unavailable();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthenticated();

    const body: unknown = await request.json().catch(() => null);
    const parsed = deleteAccountSchema.safeParse(body ?? {});
    if (!parsed.success) return invalid(parsed.error);

    const db = getDb();
    const owned = await ownedWorkspace(db, session.user.id);
    if (owned && owned.memberCount > 1 && parsed.data.workspacePath !== "delete-with-it") {
      logRoute(`DELETE ${ROUTE}`, 409, owned.id);
      return NextResponse.json(
        {
          message: ACCOUNT_MESSAGE.workspacePathRequired,
          ownedWorkspace: {
            id: owned.id,
            name: owned.name,
            memberCount: owned.memberCount,
            requiresExplicitPath: true,
          },
        },
        { status: 409 },
      );
    }

    const deleted = await deleteAccount(db, session.user.id, session.user.email);
    logRoute(`DELETE ${ROUTE}`, 200, deleted.workspaceId);
    return NextResponse.json({ message: ACCOUNT_MESSAGE.deleted, redirectTo: "/login" });
  } catch (error) {
    logFailure(`DELETE ${ROUTE}`, error);
    return unavailable();
  }
}
