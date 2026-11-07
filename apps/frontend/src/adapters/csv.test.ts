import assert from "node:assert/strict";
import test from "node:test";

import { reconcile } from "../core/reconcile.ts";
import { StatementParseError } from "../core/statement.ts";
import { parseCsvStatement, parseStatementDate, statementFromRows } from "./csv.ts";

/**
 * US-10 / US-44: a mapped CSV (or worksheet rows) produces the same canonical statement
 * a Jago PDF does, and a malformed file names the offending input instead of importing
 * a partial statement.
 */

const MAPPING = {
  date: "Tanggal",
  description: "Deskripsi",
  amount: "Nominal",
  balance: "Saldo",
  time: "Waktu",
  ref: "Referensi",
};

const CSV = `Tanggal,Deskripsi,Nominal,Saldo,Waktu,Referensi
02/04/2026,"Transfer masuk, dari BUDI","Rp 2.500.000","Rp 7.500.000",09:15,TRF-1
2026-04-03,Pembayaran QRIS KATERING,"-Rp 750.000","Rp 6.750.000",14:02,
10/04/2026,Setoran tunai,"Rp 500.000","Rp 7.250.000",,`;

test("mapped CSV columns parse to the canonical statement shape (US-10)", () => {
  const statement = parseCsvStatement(CSV, MAPPING, "Kantong Nikah");
  const [pocket] = statement.pockets;

  assert.equal(statement.kind, "csv");
  assert.equal(pocket.name, "Kantong Nikah");
  assert.equal(pocket.transactions.length, 3);
  assert.deepEqual(
    pocket.transactions.map((tx) => [tx.date, tx.time, tx.description, tx.amountMinor, tx.balanceMinor]),
    [
      ["2026-04-02", "09:15", "Transfer masuk, dari BUDI", 250_000_000, 750_000_000],
      ["2026-04-03", "14:02", "Pembayaran QRIS KATERING", -75_000_000, 675_000_000],
      ["2026-04-10", "", "Setoran tunai", 50_000_000, 725_000_000],
    ],
  );
  assert.equal(pocket.transactions[0].ref, "TRF-1");

  // Derived opening/closing/totals: this file prints none, and the chain still proves it.
  assert.equal(pocket.openingBalanceMinor, 500_000_000);
  assert.equal(pocket.totalInMinor, 300_000_000);
  assert.equal(pocket.totalOutMinor, 75_000_000);
  assert.equal(pocket.closingBalanceMinor, 725_000_000);
  assert.deepEqual(reconcile(pocket).issues, []);
});

test("a semicolon export (Excel id-ID) maps the same way", () => {
  const semicolon = `Tanggal;Deskripsi;Nominal;Saldo
02/04/2026;Transfer masuk, dari BUDI;Rp 2.500.000;Rp 7.500.000
03/04/2026;Pembayaran QRIS;Rp -750.000;Rp 6.750.000`;

  const [pocket] = parseCsvStatement(semicolon, { ...MAPPING, time: undefined, ref: undefined }).pockets;
  assert.equal(pocket.transactions.length, 2);
  assert.equal(pocket.transactions[0].description, "Transfer masuk, dari BUDI");
  assert.equal(pocket.transactions[1].amountMinor, -75_000_000);
});

test("worksheet rows go through the same mapper — the XLSX path has no second implementation", () => {
  const worksheet = [
    ["Tanggal", "Deskripsi", "Nominal", "Saldo"],
    ["02/04/2026", "Transfer masuk dari BUDI", "Rp 2.500.000", "Rp 7.500.000"],
    ["03/04/2026", "Pembayaran QRIS", "-Rp 750.000", "Rp 6.750.000"],
  ];

  const mapped = statementFromRows(
    worksheet,
    { date: "Tanggal", description: "Deskripsi", amount: "Nominal", balance: "Saldo" },
    "Kantong Nikah",
  );

  assert.equal(mapped.kind, "csv");
  assert.deepEqual(
    mapped.pockets[0].transactions.map((tx) => [tx.date, tx.amountMinor, tx.balanceMinor]),
    [
      ["2026-04-02", 250_000_000, 750_000_000],
      ["2026-04-03", -75_000_000, 675_000_000],
    ],
  );
});

test("a malformed amount names the offending line and persists nothing (US-44)", () => {
  const broken = `Tanggal,Deskripsi,Nominal,Saldo
02/04/2026,Transfer masuk,"2.500.000,00,00",Rp 7.500.000`;

  assert.throws(
    () => parseCsvStatement(broken, { ...MAPPING, time: undefined, ref: undefined }),
    (error: unknown) => {
      assert.ok(error instanceof StatementParseError);
      assert.equal(error.line, 2);
      assert.match(error.message, /Baris 2/);
      assert.match(error.message, /nominal/);
      return true;
    },
  );
});

test("an unmappable file names the missing column", () => {
  assert.throws(
    () => parseCsvStatement(CSV, { ...MAPPING, balance: "Saldo Akhir" }),
    (error: unknown) =>
      error instanceof StatementParseError && /"Saldo Akhir" tidak ditemukan/.test(error.message),
  );

  assert.throws(
    () => parseCsvStatement(CSV, { ...MAPPING, amount: "" }),
    (error: unknown) => error instanceof StatementParseError && /Kolom nominal belum dipilih/.test(error.message),
  );
});

test("dates accept the three shapes a bank export uses, and refuse impossible ones", () => {
  assert.equal(parseStatementDate("2026-04-13"), "2026-04-13");
  assert.equal(parseStatementDate("13/04/2026"), "2026-04-13");
  assert.equal(parseStatementDate("13-04-2026"), "2026-04-13");
  assert.equal(parseStatementDate("13 Apr 2026"), "2026-04-13");
  assert.equal(parseStatementDate("13 April 2026"), "2026-04-13");

  assert.equal(parseStatementDate("31/02/2026"), null);
  assert.equal(parseStatementDate("2026-13-01"), null);
  assert.equal(parseStatementDate("kemarin"), null);
  assert.equal(parseStatementDate(""), null);
});
