import assert from "node:assert/strict";
import test from "node:test";

import { reconcile } from "../core/reconcile.ts";
import { StatementParseError } from "../core/statement.ts";
import { jagoStatementSource, parseJagoText } from "./jago.ts";

/**
 * US-09 / US-44: a redacted Jago-style e-statement imports to the canonical shape, a
 * PDF without a text layer fails cleanly (never OCR), and an unreadable line is named.
 */

const STATEMENT = `Bank Jago
Nama: AYU LESTARI
No. Rekening: 1234567890
Periode: 01 April 2026 - 30 April 2026

Kantong: Kantong Nikah
Saldo Awal: Rp 5.000.000
02 Apr 2026 09:15 Transfer masuk dari BUDI Rp 2.500.000 Rp 7.500.000
03 Apr 2026 14:02 Pembayaran QRIS KATERING -Rp 750.000 Rp 6.750.000
10 Apr 2026 08:00 Setoran tunai Rp 500.000 Rp 7.250.000
Saldo Akhir: Rp 7.250.000
Total Pemasukan: Rp 3.000.000
Total Pengeluaran: Rp 750.000

Kantong: Kantong Harian
Saldo Awal: Rp 250.000
05 Apr 2026 10:30 Beli pulsa -Rp 50.000 Rp 200.000
Saldo Akhir: Rp 200.000`;

test("a Jago statement parses to the canonical shape, pocket by pocket (US-09/US-11)", () => {
  const statement = jagoStatementSource.parse({ kind: "pdf-text", text: STATEMENT });

  assert.equal(statement.bank, "Bank Jago");
  assert.equal(statement.kind, "pdf-text");
  assert.equal(statement.accountName, "AYU LESTARI");
  assert.equal(statement.accountNo, "1234567890");
  assert.equal(statement.period, "01 April 2026 - 30 April 2026");
  assert.deepEqual(
    statement.pockets.map((pocket) => pocket.name),
    ["Kantong Nikah", "Kantong Harian"],
  );

  const [nikah, harian] = statement.pockets;
  assert.equal(nikah.openingBalanceMinor, 500_000_000);
  assert.equal(nikah.totalInMinor, 300_000_000);
  assert.equal(nikah.totalOutMinor, 75_000_000);
  assert.equal(nikah.closingBalanceMinor, 725_000_000);
  assert.equal(nikah.transactions.length, 3);

  assert.deepEqual(
    nikah.transactions.map((tx) => [tx.date, tx.time, tx.description, tx.amountMinor, tx.balanceMinor, tx.direction]),
    [
      ["2026-04-02", "09:15", "Transfer masuk dari BUDI", 250_000_000, 750_000_000, "in"],
      ["2026-04-03", "14:02", "Pembayaran QRIS KATERING", -75_000_000, 675_000_000, "out"],
      ["2026-04-10", "08:00", "Setoran tunai", 50_000_000, 725_000_000, "in"],
    ],
  );

  // The second pocket prints no totals, so they come from its own rows (US-11 scoping).
  assert.equal(harian.totalInMinor, 0);
  assert.equal(harian.totalOutMinor, 5_000_000);
  assert.equal(harian.closingBalanceMinor, 20_000_000);
});

test("both pockets reconcile — the imported statement proves itself (US-14)", () => {
  const statement = parseJagoText(STATEMENT);
  for (const pocket of statement.pockets) {
    const result = reconcile(pocket);
    assert.deepEqual(result.issues, [], pocket.name);
    assert.equal(result.ok, true, pocket.name);
  }
});

test("a PDF with no text layer fails cleanly and never falls back to OCR (US-09/US-44)", () => {
  assert.throws(
    () => jagoStatementSource.parse({ kind: "pdf-text", text: "" }),
    (error: unknown) => {
      assert.ok(error instanceof StatementParseError);
      assert.match(error.message, /lapisan teks/);
      assert.match(error.message, /OCR/);
      return true;
    },
  );
});

test("a file that is not a Jago statement is a parse failure, not an empty import", () => {
  assert.throws(
    () => parseJagoText("Faktur Pajak\nNomor: 123\n"),
    (error: unknown) => error instanceof StatementParseError && /Tidak ada mutasi/.test(error.message),
  );
});

test("an unreadable row is named with its line number (US-44)", () => {
  const broken = `Kantong: Kantong Nikah
Saldo Awal: Rp 5.000.000
02 Apr 2026 09:15 Transfer masuk dari BUDI Rp 2.500.000
Saldo Akhir: Rp 7.500.000`;

  assert.throws(
    () => parseJagoText(broken),
    (error: unknown) => {
      assert.ok(error instanceof StatementParseError);
      assert.equal(error.line, 3);
      assert.match(error.message, /Baris 3/);
      return true;
    },
  );
});
