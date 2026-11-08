import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { logFailure, unavailable } from "@/lib/http";
import { confirmImport } from "@/lib/imports/service";
import { membershipForApi } from "@/lib/membership";

/**
 * US-17: confirm a flagged import so it may enter trusted totals. One row is written —
 * the flag — and the WHERE clause carries both the workspace and "still flagged", so a
 * guessed id cannot confirm another couple's import (AGENTS §4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; importId: string }> },
) {
  const { id, importId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  try {
    const confirmed = await confirmImport(getDb(), id, importId);
    if (!confirmed) {
      return NextResponse.json(
        { message: "Impor yang perlu dikonfirmasi tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/imports/[importId]/confirm", error);
    return unavailable();
  }
}
