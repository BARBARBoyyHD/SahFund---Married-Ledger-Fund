import assert from "node:assert/strict";
import test from "node:test";

import { EXPORT_HEADER, csvStream, transactionsToCsv, type ExportRow } from "./export.ts";

/**
 * US-38 / design D3: the export form is machine-readable — ISO dates, integer minor
 * units, a header row — never the in-app `Rp 1.234.567` display form (AGENTS §7).
 */

const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  occurredOn: "2026-11-01",
  description: "Katering",
  amountMinor: BigInt(-2_500_000),
  balanceMinor: BigInt(7_500_000),
  direction: "out",
  ref: "REF-1",
  ...overrides,
});

test("writes the header and raw values: ISO date, integer minor units, direction", () => {
  assert.equal(
    transactionsToCsv([row()]),
    `${EXPORT_HEADER}\n2026-11-01,Katering,-2500000,7500000,out,REF-1\n`,
  );
});

test("a missing reference is an empty cell, never 'null'", () => {
  assert.equal(
    transactionsToCsv([row({ ref: null })]),
    `${EXPORT_HEADER}\n2026-11-01,Katering,-2500000,7500000,out,\n`,
  );
});

test("quotes separators, quotes and line breaks so the file stays parseable", () => {
  assert.equal(
    transactionsToCsv([row({ description: 'Katering "Ayu", gedung' })]),
    `${EXPORT_HEADER}\n2026-11-01,"Katering ""Ayu"", gedung",-2500000,7500000,out,REF-1\n`,
  );
  assert.match(transactionsToCsv([row({ description: "baris\nbaru" })]), /"baris\nbaru"/);
});

test("no rows still produces a valid header-only file", () => {
  assert.equal(transactionsToCsv([]), `${EXPORT_HEADER}\n`);
});

test("the streamed body is byte-identical to the text form", async () => {
  const rows = [row(), row({ occurredOn: "2026-11-02", amountMinor: BigInt(1_000_000), direction: "in" })];

  const streamed = await new Response(csvStream(rows)).text();
  assert.equal(streamed, transactionsToCsv(rows));
});
