import { NextResponse } from "next/server";

import { createCommitment } from "@/lib/commitments/add-commitment";
import { createCommitmentSchema } from "@/lib/commitments/commitment-schema";
import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";

/**
 * US-28 / BRD FR-09. BRD documents `POST /w/:id/commitments`; this app's handlers live
 * under `/api/workspaces/[id]/…` (same drift as transactions). Any member may add a
 * commitment; the server derives status and stores money as integer minor units.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createCommitmentSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createCommitment(getDb(), id, parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { message: "Kategori tidak dikenal di workspace ini." },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/commitments", error);
    return unavailable();
  }
}
