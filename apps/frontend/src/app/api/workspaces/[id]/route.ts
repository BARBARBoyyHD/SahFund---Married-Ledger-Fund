import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { deleteWorkspace } from "@/lib/deletion";
import { logFailure, logRoute, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";

const ROUTE = "DELETE /api/workspaces/[id]";

/**
 * US-39 (BRD FR-12): the owner deletes the workspace. The role check is the boundary
 * (AGENTS §9) — `membershipForApi` resolves the caller's own row, a URL id proves
 * nothing. The cascade is one batch in `lib/deletion.ts`; this handler only answers.
 *
 * The session cookie is left alone on purpose: no session row references the workspace,
 * and the account itself survives, so the next request reads a valid session.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  if (access.role !== "owner") {
    logRoute(ROUTE, 403, id);
    return NextResponse.json({ message: WORKSPACE_MESSAGE.ownerOnly }, { status: 403 });
  }

  try {
    await deleteWorkspace(getDb(), id);
    logRoute(ROUTE, 200, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure(ROUTE, error);
    return unavailable();
  }
}
