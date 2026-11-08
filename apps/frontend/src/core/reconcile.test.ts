import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE_TOLERANCE_MINOR, TOTALS_TOLERANCE_MINOR, reconcile } from "./reconcile.ts";
import type { StatementPocket, StatementTransaction } from "./statement.ts";

/**
 * US-14/US-15: the reconciliation math, tested without a database. The tolerances are
 * part of the contract (Rp 1 chain, Rp 0.05 totals), so their exact boundaries are
 * pinned here rather than in a comment.
 */

/** Whole rupiah → minor units, the unit `reconcile` works in. */
const rp = (rupiah: number) => rupiah * 100;

const tx = (
  date: string,
  amountMinor: number,
  balanceMinor: number,
  time = "09:00",
  description = "Mutasi",
): StatementTransaction => ({
  date,
  time,
  description,
  amountMinor,
  balanceMinor,
  direction: amountMinor < 0 ? "out" : "in",
  ref: "",
  line: 1,
  raw: `${date} ${description}`,
});

const pocket = (overrides: Partial<StatementPocket> = {}): StatementPocket => ({
  name: "Kantong Nikah",
  openingBalanceMinor: rp(1_000_000),
  totalInMinor: rp(250_000),
  totalOutMinor: rp(100_000),
  closingBalanceMinor: rp(1_150_000),
  transactions: [
    tx("2026-04-02", rp(250_000), rp(1_250_000)),
    tx("2026-04-03", rp(-100_000), rp(1_150_000)),
  ],
  ...overrides,
});

test("a statement whose chain and totals agree is green (US-14)", () => {
  const result = reconcile(pocket());

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.openingBalanceMinor, rp(1_000_000));
  assert.equal(result.totalInMinor, rp(250_000));
  assert.equal(result.totalOutMinor, rp(100_000));
  assert.equal(result.closingBalanceMinor, rp(1_150_000));
});

test("a tampered amount is never green — the chain issue names the row (US-14/US-15)", () => {
  const result = reconcile(
    pocket({
      // The amount changed, the printed balances did not: the chain is now broken.
      transactions: [tx("2026-04-02", rp(350_000), rp(1_250_000)), tx("2026-04-03", rp(-100_000), rp(1_150_000))],
    }),
  );

  assert.equal(result.ok, false);
  const chain = result.issues.filter((issue) => issue.kind === "balance_chain");
  assert.equal(chain.length, 1, "one tampered row reports one issue, not a cascade");
  assert.equal(chain[0].line, 1);
  assert.match(chain[0].message, /saldo seharusnya Rp 1\.350\.000, tertulis Rp 1\.250\.000/);
});

test("the balance-chain tolerance is exactly Rp 1 — 100 minor units passes, 101 does not", () => {
  assert.equal(BALANCE_TOLERANCE_MINOR, 100);

  // The drift sits on the last row (so the implied opening is untouched).
  const within = reconcile(
    pocket({
      transactions: [tx("2026-04-02", rp(250_000), rp(1_250_000)), tx("2026-04-03", rp(-100_000), rp(1_150_000) + 100)],
      closingBalanceMinor: rp(1_150_000) + 100,
    }),
  );
  assert.equal(within.ok, true, "Rp 1 of rounding is tolerated");

  const beyond = reconcile(
    pocket({
      transactions: [tx("2026-04-02", rp(250_000), rp(1_250_000)), tx("2026-04-03", rp(-100_000), rp(1_150_000) + 101)],
      closingBalanceMinor: rp(1_150_000) + 101,
    }),
  );
  assert.equal(beyond.ok, false);
  assert.equal(beyond.issues[0].kind, "balance_chain");
});

test("the totals tolerance is exactly Rp 0.05 — 5 minor units passes, 6 does not", () => {
  assert.equal(TOTALS_TOLERANCE_MINOR, 5);

  assert.equal(reconcile(pocket({ totalInMinor: rp(250_000) + 5 })).ok, true);
  assert.equal(reconcile(pocket({ totalInMinor: rp(250_000) + 6 })).ok, false);

  const result = reconcile(pocket({ totalOutMinor: rp(100_000) + 6 }));
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].kind, "totals");
  assert.match(result.issues[0].message, /total keluar/i);
});

test("the closing balance alone can break the chain", () => {
  const result = reconcile(pocket({ closingBalanceMinor: rp(1_200_000) }));

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].kind, "balance_chain");
  assert.match(result.issues[0].message, /saldo akhir/i);
});

test("an opening balance the first row contradicts is its own issue", () => {
  const result = reconcile(pocket({ openingBalanceMinor: rp(900_000), closingBalanceMinor: rp(1_050_000) }));

  assert.equal(result.ok, false);
  assert.equal(result.issues[0].kind, "opening");
  assert.equal(result.issues[0].line, 1);
  assert.match(result.issues[0].message, /saldo awal/i);
});

test("a statement with no rows is an empty issue, not a green one", () => {
  const result = reconcile(
    pocket({
      transactions: [],
      openingBalanceMinor: 0,
      totalInMinor: 0,
      totalOutMinor: 0,
      closingBalanceMinor: 0,
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.kind),
    ["empty"],
  );
});

test("a row the statement prints twice is reported as a duplicate (US-13/US-15)", () => {
  // Amount 0 keeps the chain intact so the duplicate check is what this test observes.
  const result = reconcile(
    pocket({
      openingBalanceMinor: 0,
      totalInMinor: 0,
      totalOutMinor: 0,
      closingBalanceMinor: 0,
      transactions: [tx("2026-04-02", 0, 0), { ...tx("2026-04-02", 0, 0), line: 2 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.kind),
    ["duplicate"],
  );
  assert.equal(result.issues[0].line, 2);
  assert.match(result.issues[0].message, /baris 1/);
});
