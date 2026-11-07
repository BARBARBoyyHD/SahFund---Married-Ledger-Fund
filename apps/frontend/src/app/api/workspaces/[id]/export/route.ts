import { connection } from "next/server";

import { getDb } from "@/lib/db";
import { exportGate } from "@/lib/entitlement/gate";
import { locked, logFailure, unavailable } from "@/lib/http";
import { csvStream, readExportRows } from "@/lib/ledger/export";
import { membershipForApi } from "@/lib/membership";

/**
 * US-38: stream this workspace's rows as CSV. Session + membership first (AGENTS §9),
 * then the entitlement gate, then one workspace-scoped query — the WHERE carries the
 * workspace id, so another couple's rows cannot appear in the file.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // A per-user file must be built per request, never prerendered or cached (§4/§9).
  await connection();

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const db = getDb();

  try {
    const gate = await exportGate(db, id);
    if (!gate.ok) return locked(gate.message);

    const rows = await readExportRows(db, id);
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csvStream(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sahfund-${today}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logFailure("GET /api/workspaces/[id]/export", error);
    return unavailable();
  }
}
