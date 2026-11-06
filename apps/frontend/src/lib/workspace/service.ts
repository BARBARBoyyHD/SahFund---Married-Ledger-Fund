import { eq } from "drizzle-orm";

import { generatePocketCode } from "../../core/pocket-code.ts";
import { INVITE_LIMIT, allowAttempt } from "../auth/rate-limit.ts";
import { classifyError, type Db } from "../db/index.ts";
import { categories, members, workspaces } from "../db/schema.ts";
import { sendInviteEmail, type MailConfig } from "../mail.ts";
import { seedCategoryRows } from "./categories.ts";
import type { CreateWorkspaceData, UpdateWorkspaceDetailsData } from "./schema.ts";

/**
 * The workspace writes, one function per mutation. Route handlers stay orchestration
 * (session → Zod → this → response, AGENTS §5), and every invariant here is enforced by
 * a database constraint: nothing counts members, reserves a slot, or reads-then-writes.
 * Each function returns a typed reason; the handler owns the Bahasa Indonesia message.
 */

export type CreateWorkspaceResult =
  | { ok: true; id: string; inviteCode: string }
  | { ok: false; reason: "already-member" | "unavailable" };

export async function createWorkspace(
  db: Db,
  userId: string,
  data: CreateWorkspaceData,
): Promise<CreateWorkspaceResult> {
  const id = crypto.randomUUID();

  // The code is generated, never pre-checked for uniqueness (design D7): a collision
  // retries once with a fresh code, then answers unavailable — never a duplicate.
  for (let attempt = 0; attempt < 2; attempt++) {
    const inviteCode = generatePocketCode();

    try {
      // One atomic batch: a refused membership leaves no orphan workspace, and a new
      // workspace always has its ten seeded categories (AGENTS §2, US-22/BRD FR-06).
      await db.batch([
        db.insert(workspaces).values({
          id,
          ownerId: userId,
          name: data.name,
          weddingDate: data.weddingDate,
          budgetTargetMinor: data.budgetTargetMinor === null ? null : BigInt(data.budgetTargetMinor),
          inviteCode,
        }),
        db.insert(members).values({ workspaceId: id, userId, role: "owner" }),
        db.insert(categories).values(seedCategoryRows(id)),
      ]);
      return { ok: true, id, inviteCode };
    } catch (error) {
      const violation = classifyError(error);
      if (!violation) return { ok: false, reason: "unavailable" };

      if (violation.table === "workspaces" && violation.columns.includes("inviteCode")) {
        if (attempt === 0) continue;
        return { ok: false, reason: "unavailable" };
      }

      // UNIQUE(workspaces.ownerId) is the backstop and UNIQUE(members.userId) the rule
      // (BRD FR-02): either one means this account already belongs to a workspace.
      const alreadyMember =
        (violation.table === "workspaces" && violation.columns.includes("ownerId")) ||
        (violation.table === "members" && violation.columns.includes("userId"));

      return { ok: false, reason: alreadyMember ? "already-member" : "unavailable" };
    }
  }

  return { ok: false, reason: "unavailable" };
}

export type JoinWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; reason: "invalid-code" | "full" | "already-here" | "already-elsewhere" | "unavailable" };

export async function joinWorkspace(
  db: Db,
  userId: string,
  code: string,
): Promise<JoinWorkspaceResult> {
  // The code is the credential: one point lookup by its unique column.
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.inviteCode, code))
    .limit(1);

  if (!workspace) return { ok: false, reason: "invalid-code" };

  try {
    // The constraint is the transaction (design D6) — no member counting, no pre-check.
    await db.insert(members).values({ workspaceId: workspace.id, userId, role: "member" });
    return { ok: true, workspaceId: workspace.id };
  } catch (error) {
    const violation = classifyError(error);
    if (!violation || violation.table !== "members") return { ok: false, reason: "unavailable" };

    // The write was already refused; this read only picks the message (design D5). A taken
    // member slot and a duplicate membership can surface as either index, so ask who the
    // caller is: already in this workspace, already elsewhere, or a genuinely full one.
    const [mine] = await db
      .select({ workspaceId: members.workspaceId })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);

    if (mine) {
      return {
        ok: false,
        reason: mine.workspaceId === workspace.id ? "already-here" : "already-elsewhere",
      };
    }

    // The caller has no membership, so the only index left is UNIQUE(workspaceId, role).
    return { ok: false, reason: "full" };
  }
}

export type RotateInviteCodeResult =
  | { ok: true; inviteCode: string }
  | { ok: false; reason: "unavailable" };

export async function rotateInviteCode(db: Db, workspaceId: string): Promise<RotateInviteCodeResult> {
  // A single UPDATE makes the old code invalid immediately and leaves memberships alone.
  for (let attempt = 0; attempt < 2; attempt++) {
    const inviteCode = generatePocketCode();

    try {
      await db.update(workspaces).set({ inviteCode }).where(eq(workspaces.id, workspaceId));
      return { ok: true, inviteCode };
    } catch (error) {
      const violation = classifyError(error);
      if (violation?.columns.includes("inviteCode") && attempt === 0) continue;
      return { ok: false, reason: "unavailable" };
    }
  }

  return { ok: false, reason: "unavailable" };
}

export async function updateWorkspaceDetails(
  db: Db,
  workspaceId: string,
  data: UpdateWorkspaceDetailsData,
): Promise<{ ok: boolean }> {
  // Only the columns the payload carries — nothing else in the row changes (US-08).
  const changes: { weddingDate?: string | null; budgetTargetMinor?: bigint | null } = {};
  if (data.weddingDate !== undefined) changes.weddingDate = data.weddingDate;
  if (data.budgetTargetMinor !== undefined) {
    changes.budgetTargetMinor = data.budgetTargetMinor === null ? null : BigInt(data.budgetTargetMinor);
  }

  await db.update(workspaces).set(changes).where(eq(workspaces.id, workspaceId));
  return { ok: true };
}

export type InviteOutcome =
  | { status: "sent" }
  | { status: "fallback"; code: string; joinUrl: string }
  | { status: "rate-limited" }
  | { status: "unavailable" };

export async function sendInvite(
  db: Db,
  workspaceId: string,
  email: string,
  options: { origin: string; mail: MailConfig; fetchImpl?: typeof fetch },
): Promise<InviteOutcome> {
  // NFR-02, spent before the email leaves: a refused attempt writes nothing (design D6).
  if (!(await allowAttempt(db, `ws:${workspaceId}`, INVITE_LIMIT))) {
    return { status: "rate-limited" };
  }

  const [workspace] = await db
    .select({ inviteCode: workspaces.inviteCode })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return { status: "unavailable" };

  const joinUrl = new URL(`/join?code=${encodeURIComponent(workspace.inviteCode)}`, options.origin).toString();
  const sent = await sendInviteEmail(
    { to: email, code: workspace.inviteCode, joinUrl },
    options.mail,
    options.fetchImpl,
  );

  if (sent.ok) return { status: "sent" };

  // The invite stays valid: the screen shows the code and link for manual sharing instead.
  // Reason and status only — never the code, the recipient, or the body (ITA §11.9).
  console.warn("[invite] send failed, falling back to manual sharing", {
    reason: sent.reason,
    status: sent.status,
  });
  return { status: "fallback", code: workspace.inviteCode, joinUrl };
}
