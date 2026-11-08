import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import {
  createManualTransactionSchema,
  updateTransactionClassificationSchema,
} from "@/lib/ledger/schema";
import {
  deleteTransaction,
  readTransactionTarget,
  updateManualTransaction,
  updateTransactionClassification,
  type TransactionTarget,
  type UpdateTransactionResult,
} from "@/lib/ledger/service";
import { membershipForApi } from "@/lib/membership";

/**
 * US-20 + the user-directed edit/delete on the ledger. One row per request, always scoped
 * by workspace membership; both roles share the ledger, so no owner check. The row type
 * decides which schema applies: manual rows take the full edit (and recompute the dedupe
 * hash), imported rows only the classification (their amounts/dates are statement facts).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; txId: string }> },
) {
  const { id, txId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);

  try {
    const db = getDb();
    const target = await readTransactionTarget(db, id, txId);
    if (!target) return notFound();

    const result =
      target.importId !== null
        ? await patchClassification(body, id, txId)
        : await patchManual(body, id, txId, target);

    return result;
  } catch (error) {
    logFailure("PATCH /api/workspaces/[id]/transactions/[txId]", error);
    return unavailable();
  }
}

async function patchClassification(body: unknown, workspaceId: string, txId: string) {
  const parsed = updateTransactionClassificationSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateTransactionClassification(
    getDb(),
    workspaceId,
    txId,
    parsed.data,
  );
  return updateResponse(result);
}

async function patchManual(
  body: unknown,
  workspaceId: string,
  txId: string,
  target: TransactionTarget,
) {
  const parsed = createManualTransactionSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateManualTransaction(
    getDb(),
    workspaceId,
    txId,
    parsed.data,
    target,
  );
  return updateResponse(result);
}

function updateResponse(result: UpdateTransactionResult) {
  if (result.ok) return NextResponse.json({ ok: true });

  if (result.reason === "conflict") {
    return NextResponse.json(
      { message: "Transaksi serupa sudah ada. Periksa tanggal dan nominalnya." },
      { status: 409 },
    );
  }
  if (result.reason === "unknown-reference") {
    return NextResponse.json(
      { message: "Kategori atau anggota tidak dikenal di workspace ini." },
      { status: 422 },
    );
  }
  return notFound();
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; txId: string }> },
) {
  const { id, txId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  try {
    const deleted = await deleteTransaction(getDb(), id, txId);
    if (!deleted) return notFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure("DELETE /api/workspaces/[id]/transactions/[txId]", error);
    return unavailable();
  }
}

function notFound() {
  return NextResponse.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
}
