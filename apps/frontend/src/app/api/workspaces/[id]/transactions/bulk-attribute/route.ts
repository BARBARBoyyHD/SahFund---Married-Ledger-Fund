import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { bulkAttributeSchema, bulkAttributeTransactions } from "@/lib/ledger/bulk-attribute";
import { membershipForApi } from "@/lib/membership";

/**
 * US-24 / BRD FR-08. Orchestration only: membership → shared Zod → lib → respond
 * (AGENTS §5). Any member may attribute rows to a partner (shared ledger); the response
 * carries every selected id exactly once, in `updated` or `notFound`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = bulkAttributeSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await bulkAttributeTransactions(getDb(), id, parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { message: "Anggota tidak dikenal di workspace ini." },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/transactions/bulk-attribute", error);
    return unavailable();
  }
}
