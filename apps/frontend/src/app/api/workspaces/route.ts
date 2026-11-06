import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable, unauthenticated } from "@/lib/http";
import { getSession } from "@/lib/session";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";
import { createWorkspaceSchema } from "@/lib/workspace/schema";
import { createWorkspace } from "@/lib/workspace/workspace-mutations";

/**
 * Create the workspace and its owner membership in one batch. The "one workspace per
 * user" rule is the database's (UNIQUE(workspaces.ownerId), UNIQUE(members.userId));
 * this handler only translates the refusal (BRD FR-02, AGENTS §3).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthenticated();

  const body: unknown = await request.json().catch(() => null);
  const parsed = createWorkspaceSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createWorkspace(getDb(), session.user.id, parsed.data);

    if (result.ok) {
      return NextResponse.json({ id: result.id, inviteCode: result.inviteCode }, { status: 201 });
    }

    if (result.reason === "already-member") {
      return NextResponse.json({ message: WORKSPACE_MESSAGE.alreadyMember }, { status: 409 });
    }

    return unavailable();
  } catch (error) {
    logFailure("POST /api/workspaces", error);
    return unavailable();
  }
}
