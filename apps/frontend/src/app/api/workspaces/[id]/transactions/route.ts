import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { createManualTransactionSchema } from "@/lib/ledger/schema";
import { createManualTransaction } from "@/lib/ledger/service";
import { membershipForApi } from "@/lib/membership";

/**
 * US-21 / BRD FR-05: record cash and other-bank payments. Any member may write to the
 * shared ledger (no owner check). The dedupe hash is computed server-side from the parsed
 * row; the unique index refuses a duplicate and this handler maps that to a clear 409.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createManualTransactionSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createManualTransaction(getDb(), id, parsed.data);

    if (!result.ok) {
      if (result.reason === "conflict") {
        return NextResponse.json(
          { message: "Transaksi serupa sudah ada. Periksa tanggal dan nominalnya." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: "Kategori atau anggota tidak dikenal di workspace ini." },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/transactions", error);
    return unavailable();
  }
}
