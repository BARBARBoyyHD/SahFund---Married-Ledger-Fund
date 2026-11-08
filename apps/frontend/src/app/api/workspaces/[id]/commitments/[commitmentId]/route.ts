import { NextResponse } from "next/server";

import { updateCommitmentSchema } from "@/lib/commitments/commitment-schema";
import { updateCommitment } from "@/lib/commitments/update-commitment";
import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";

/**
 * US-28: DP and pelunasan against one commitment. The body carries the settlement form's
 * `total`, `paid` and `dueOn` (same rupiah-text inputs as creation); the server derives
 * `status` and stores minor units. Any member may update the shared commitment list, so
 * there is no owner check — only the workspace scope on the write.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commitmentId: string }> },
) {
  const { id, commitmentId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateCommitmentSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateCommitment(getDb(), id, commitmentId, parsed.data);

    if (!result.ok) {
      return NextResponse.json({ message: "Komitmen tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (error) {
    logFailure("PATCH /api/workspaces/[id]/commitments/[commitmentId]", error);
    return unavailable();
  }
}
