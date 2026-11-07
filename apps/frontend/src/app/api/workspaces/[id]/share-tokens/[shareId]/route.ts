import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { revokeShareToken } from "@/lib/share/manage";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";

/**
 * BRD FR-11 / US-34: owner-only revoke. DELETE keeps the row and stamps `revokedAt`, so
 * the list can still show what was revoked and the next resolve refuses the URL. The
 * write is workspace-scoped; repeating it is a no-op success (the row still matches).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;
  if (access.role !== "owner") {
    return NextResponse.json({ message: WORKSPACE_MESSAGE.ownerOnly }, { status: 403 });
  }

  try {
    const revoked = await revokeShareToken(getDb(), id, shareId, new Date());
    if (!revoked) {
      return NextResponse.json({ message: "Tautan tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure("DELETE /api/workspaces/[id]/share-tokens/[shareId]", error);
    return unavailable();
  }
}
