import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { members, workspaces } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";

/**
 * The caller's one workspace row (UNIQUE(members.userId)), joined in a single scoped
 * query. Never keyed by anything the client sent (AGENTS §4/§9). Returns null so the
 * dashboard can keep its create/join prompt; subpages use `requireWorkspace` instead.
 */
export type WorkspaceContext = {
  workspaceId: string;
  name: string;
  weddingDate: string | null;
  budgetTargetMinor: bigint | null;
  inviteCode: string;
  role: string;
};

export async function readWorkspace(userId: string): Promise<WorkspaceContext | null> {
  const [row] = await getDb()
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      weddingDate: workspaces.weddingDate,
      budgetTargetMinor: workspaces.budgetTargetMinor,
      inviteCode: workspaces.inviteCode,
      role: members.role,
    })
    .from(members)
    .innerJoin(workspaces, eq(members.workspaceId, workspaces.id))
    .where(eq(members.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * For dashboard subpages that cannot render without a workspace: signed out → `/login`
 * (`requireSession`), no workspace → the dashboard's create/join prompt.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await requireSession();
  const workspace = await readWorkspace(session.user.id);
  if (!workspace) redirect("/dashboard");
  return workspace;
}
