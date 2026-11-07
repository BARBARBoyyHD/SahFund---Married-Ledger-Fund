import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { importGate } from "@/lib/entitlement/gate";
import { invalid, locked, logFailure, unavailable } from "@/lib/http";
import { importStatementSchema } from "@/lib/imports/schema";
import { commitImport } from "@/lib/imports/service";
import { membershipForApi } from "@/lib/membership";

/**
 * US-12/US-13/US-16: commit a parsed statement. Orchestration only — membership, the
 * shared Zod body, then one service call that re-runs reconciliation and writes the
 * import row plus its rows in a single `db.batch()`.
 *
 * A reconciliation failure still stores the import with `reconciled = false` (the user
 * chose to continue); a *parse* failure never reaches this handler (US-44).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  // US-35: the first import is free; a free workspace's second import is refused
  // before the body is parsed or any row is written, so it spends no rate-limit
  // budget and stores nothing.
  try {
    const gate = await importGate(getDb(), id);
    if (!gate.ok) return locked(gate.message);
  } catch (error) {
    logFailure("POST /api/workspaces/[id]/imports", error);
    return unavailable();
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = importStatementSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await commitImport(getDb(), id, parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { message: "Terlalu banyak impor dalam satu jam terakhir. Coba lagi nanti." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        importId: result.importId,
        inserted: result.inserted,
        duplicates: result.duplicates,
        // The server's verdict, which is what the preview must render (US-16).
        reconciliation: result.reconciliation,
      },
      { status: 201 },
    );
  } catch (error) {
    // Route, status and workspace id only — never a row or an amount (ITA §11.9).
    logFailure("POST /api/workspaces/[id]/imports", error);
    return unavailable();
  }
}
