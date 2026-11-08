import { asc, eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { transactions } from "../db/schema.ts";

/**
 * US-38 / design D3: the export is machine-readable, not the display form used in
 * the app. Dates stay `YYYY-MM-DD` and money stays integer minor units — formatting
 * (`Rp 1.234.567`, id-ID) belongs to `src/core/money.ts` and the screens only.
 */

export type ExportRow = {
  occurredOn: string;
  description: string;
  amountMinor: bigint;
  balanceMinor: bigint;
  direction: string;
  ref: string | null;
};

export const EXPORT_HEADER = "occurredOn,description,amountMinor,balanceMinor,direction,ref";

/**
 * One workspace-scoped query (AGENTS §4): the WHERE carries the workspace id, so a
 * row from another workspace can never reach the file. Ordered so the same data
 * always produces the same bytes.
 */
export async function readExportRows(db: Db, workspaceId: string): Promise<ExportRow[]> {
  return db
    .select({
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      amountMinor: transactions.amountMinor,
      balanceMinor: transactions.balanceMinor,
      direction: transactions.direction,
      ref: transactions.ref,
    })
    .from(transactions)
    .where(eq(transactions.workspaceId, workspaceId))
    .orderBy(asc(transactions.occurredOn), asc(transactions.id));
}

/** RFC 4180: quote a cell only when it contains a separator, a quote, or a line break. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toCsvRow(row: ExportRow): string {
  return [
    row.occurredOn,
    row.description,
    String(row.amountMinor),
    String(row.balanceMinor),
    row.direction,
    row.ref ?? "",
  ]
    .map(cell)
    .join(",");
}

/** The whole file as text — the unit-test target; the route streams the same output. */
export function transactionsToCsv(rows: ExportRow[]): string {
  return [EXPORT_HEADER, ...rows.map(toCsvRow)].join("\n") + "\n";
}

/**
 * Streams the same bytes from the fetched rows in chunks, so the Worker never builds
 * one giant string for a large ledger. D1 has no cursor: the rows are read first
 * (one query) and the stream only controls how they leave the Worker.
 */
export function csvStream(rows: ExportRow[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const CHUNK_ROWS = 500;
  let index = 0;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(EXPORT_HEADER + "\n"));
    },
    pull(controller) {
      if (index >= rows.length) {
        controller.close();
        return;
      }

      const chunk = rows.slice(index, index + CHUNK_ROWS);
      index += chunk.length;
      controller.enqueue(encoder.encode(chunk.map((row) => toCsvRow(row) + "\n").join("")));
    },
  });
}
