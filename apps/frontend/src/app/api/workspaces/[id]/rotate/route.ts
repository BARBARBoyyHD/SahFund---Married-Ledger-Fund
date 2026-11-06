import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";
import { rotateInviteCode } from "@/lib/workspace/workspace-mutations";

/**
 * Rotate the pocket code — owner only (US-07). One UPDATE: the old code stops joining
 * immediately, including links in older emails, and membership rows are untouched.
 * Hiding the button is UX; this check is the boundary (AGENTS §9).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;
  if (access.role !== "owner") {
    return NextResponse.json({ message: WORKSPACE_MESSAGE.ownerOnly }, { status: 403 });
  }

  try {
    const result = await rotateInviteCode(getDb(), id);
    if (result.ok) return NextResponse.json({ inviteCode: result.inviteCode });
    return unavailable();
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/rotate", error);
    return unavailable();
  }
}
