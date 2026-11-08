import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { createShareToken, listShareTokens } from "@/lib/share/manage";
import { shareTokenState } from "@/lib/share/token";
import { WORKSPACE_MESSAGE } from "@/lib/workspace/messages";

/**
 * BRD FR-11 / US-32–34: owner-only read-only share links. The role check here is the
 * boundary (AGENTS §9) — hiding the UI button is not authorization. Responses carry the
 * link as a path (`/r/:token`) so the client can prefix its own origin.
 */

function ownerOnly() {
  return NextResponse.json({ message: WORKSPACE_MESSAGE.ownerOnly }, { status: 403 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;
  if (access.role !== "owner") return ownerOnly();

  try {
    const now = new Date();
    const rows = await listShareTokens(getDb(), id);

    return NextResponse.json({
      tokens: rows.map((row) => ({
        id: row.id,
        token: row.token,
        url: `/r/${row.token}`,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        status: shareTokenState(row, now),
      })),
    });
  } catch (error) {
    logFailure("GET /api/workspaces/[id]/share-tokens", error);
    return unavailable();
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;
  if (access.role !== "owner") return ownerOnly();

  try {
    // Decision 5: fixed 30-day TTL — no expiry field in the request. The owner re-creates.
    const created = await createShareToken(getDb(), id, new Date());

    return NextResponse.json(
      {
        id: created.id,
        token: created.token,
        url: `/r/${created.token}`,
        expiresAt: created.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/share-tokens", error);
    return unavailable();
  }
}
