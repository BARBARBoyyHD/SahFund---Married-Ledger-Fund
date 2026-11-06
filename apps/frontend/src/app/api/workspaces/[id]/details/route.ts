import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";
import { updateWorkspaceDetailsSchema } from "@/lib/workspace/schema";
import { updateWorkspaceDetails } from "@/lib/workspace/workspace-mutations";

/**
 * Any member may set or change the wedding date and the budget target (US-08). Only the
 * columns the payload carries are written; the amount is already integer minor units
 * from the shared schema, so no float ever reaches the row (NFR-03).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateWorkspaceDetailsSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateWorkspaceDetails(getDb(), id, parsed.data);
    // The page re-reads the row after this (`router.refresh`); echoing only what the
    // payload carried would report `null` for a column that was not touched.
    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/details", error);
    return unavailable();
  }
}
