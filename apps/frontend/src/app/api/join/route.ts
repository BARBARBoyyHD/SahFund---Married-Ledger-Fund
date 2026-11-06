import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable, unauthenticated } from "@/lib/http";
import { getSession } from "@/lib/session";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";
import { joinWorkspaceSchema } from "@/lib/workspace/schema";
import { joinWorkspace } from "@/lib/workspace/service";

/**
 * Join by pocket code. The format is rejected here, before any lookup or write (US-06);
 * the two-member cap and the one-workspace-per-user rule are the database's constraints,
 * and this handler only maps the violated one to its message (design D5).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthenticated();

  const body: unknown = await request.json().catch(() => null);
  const parsed = joinWorkspaceSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await joinWorkspace(getDb(), session.user.id, parsed.data.code);

    if (result.ok) return NextResponse.json({ workspaceId: result.workspaceId }, { status: 201 });

    switch (result.reason) {
      case "invalid-code":
        return NextResponse.json({ message: WORKSPACE_MESSAGE.invalidCode }, { status: 404 });
      case "full":
        return NextResponse.json({ message: WORKSPACE_MESSAGE.full }, { status: 409 });
      case "already-here":
        return NextResponse.json({ message: WORKSPACE_MESSAGE.alreadyHere }, { status: 409 });
      case "already-elsewhere":
        return NextResponse.json({ message: WORKSPACE_MESSAGE.alreadyElsewhere }, { status: 409 });
      default:
        return unavailable();
    }
  } catch (error) {
    logFailure("POST /api/join", error);
    return unavailable();
  }
}
