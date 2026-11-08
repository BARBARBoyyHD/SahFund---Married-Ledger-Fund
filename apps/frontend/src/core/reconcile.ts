/**
 * The one reconciliation implementation (AGENTS §7). The browser preview calls it for
 * the live "Cocok dengan saldo bank" gate; the route handler calls *this same function*
 * on the posted rows and stores its verdict (US-16). Pure: no I/O, no clock, money as
 * integer minor units.
 *
 * Tolerances (BRD FR-04 / US-14): the balance chain may drift Rp 1 (100 minor units,
 * printed balances are rounded whole rupiah); the totals must agree within Rp 0.05
 * (5 minor units, sen-level rounding in a bank export).
 */

import { formatDate, formatRupiah } from "./money.ts";
import { transactionTuple, type StatementPocket, type StatementTransaction } from "./statement.ts";

export const BALANCE_TOLERANCE_MINOR = 100;
export const TOTALS_TOLERANCE_MINOR = 5;

export type ReconcileIssueKind = "balance_chain" | "totals" | "opening" | "duplicate" | "empty";

export type ReconcileIssue = {
  kind: ReconcileIssueKind;
  /** Bahasa Indonesia, rendered verbatim by the preview (US-15). */
  message: string;
  /** The offending row's line in the extracted text, when one row is at fault. */
  line?: number;
  raw?: string;
};

export type Reconciliation = {
  ok: boolean;
  openingBalanceMinor: number;
  totalInMinor: number;
  totalOutMinor: number;
  closingBalanceMinor: number;
  issues: ReconcileIssue[];
};

export function reconcile(pocket: StatementPocket): Reconciliation {
  const txs = pocket.transactions;

  const computedInMinor = txs.reduce(
    (total, tx) => (tx.amountMinor > 0 ? total + tx.amountMinor : total),
    0,
  );
  const computedOutMinor = txs.reduce(
    (total, tx) => (tx.amountMinor < 0 ? total - tx.amountMinor : total),
    0,
  );

  const result: Reconciliation = {
    ok: false,
    openingBalanceMinor: pocket.openingBalanceMinor,
    totalInMinor: computedInMinor,
    totalOutMinor: computedOutMinor,
    closingBalanceMinor: pocket.closingBalanceMinor,
    issues: [],
  };

  if (txs.length === 0) {
    result.issues.push({
      kind: "empty",
      message: "Tidak ada transaksi pada kantong ini. Periksa kantong yang dipilih.",
    });
    return result;
  }

  const issues: ReconcileIssue[] = [];

  // 1. Opening: the first row's balance minus its amount is what the chain believes.
  const first = txs[0];
  const impliedOpening = first.balanceMinor - first.amountMinor;
  if (Math.abs(impliedOpening - pocket.openingBalanceMinor) > BALANCE_TOLERANCE_MINOR) {
    issues.push({
      kind: "opening",
      message: `Saldo awal tertulis ${formatRupiah(pocket.openingBalanceMinor)}, tetapi transaksi pertama menunjukkan ${formatRupiah(impliedOpening)}.`,
      line: first.line,
      raw: first.raw,
    });
  }

  // 2. Balance chain, row by row. After a mismatch the chain re-anchors on the printed
  // balance: one tampered amount reports one issue, not every later row as well.
  let expected = pocket.openingBalanceMinor;
  for (const tx of txs) {
    expected += tx.amountMinor;
    if (Math.abs(tx.balanceMinor - expected) > BALANCE_TOLERANCE_MINOR) {
      issues.push({
        kind: "balance_chain",
        message: `${rowLabel(tx)} saldo seharusnya ${formatRupiah(expected)}, tertulis ${formatRupiah(tx.balanceMinor)}.`,
        line: tx.line,
        raw: tx.raw,
      });
      expected = tx.balanceMinor;
    }
  }
  if (Math.abs(pocket.closingBalanceMinor - expected) > BALANCE_TOLERANCE_MINOR) {
    issues.push({
      kind: "balance_chain",
      message: `Saldo akhir tertulis ${formatRupiah(pocket.closingBalanceMinor)}, seharusnya ${formatRupiah(expected)}.`,
    });
  }

  // 3. Totals against what the statement prints (Rp 0.05).
  if (Math.abs(computedInMinor - pocket.totalInMinor) > TOTALS_TOLERANCE_MINOR) {
    issues.push({
      kind: "totals",
      message: `Total masuk menurut transaksi ${formatRupiah(computedInMinor)}, tertulis ${formatRupiah(pocket.totalInMinor)}.`,
    });
  }
  if (Math.abs(computedOutMinor - pocket.totalOutMinor) > TOTALS_TOLERANCE_MINOR) {
    issues.push({
      kind: "totals",
      message: `Total keluar menurut transaksi ${formatRupiah(computedOutMinor)}, tertulis ${formatRupiah(pocket.totalOutMinor)}.`,
    });
  }

  // 4. Rows the bank printed twice inside one statement — reported, never swallowed:
  // the unique index would actually store only one of them.
  const firstLineByTuple = new Map<string, number | undefined>();
  for (const tx of txs) {
    const key = transactionTuple(tx);
    if (!firstLineByTuple.has(key)) {
      firstLineByTuple.set(key, tx.line);
      continue;
    }
    const firstLine = firstLineByTuple.get(key);
    issues.push({
      kind: "duplicate",
      message: `${rowLabel(tx)} sama persis dengan ${firstLine ? `baris ${firstLine}` : "baris sebelumnya"} — hanya satu yang akan tersimpan.`,
      line: tx.line,
      raw: tx.raw,
    });
  }

  result.issues = issues;
  result.ok = issues.length === 0;
  return result;
}

function rowLabel(tx: StatementTransaction): string {
  return tx.time ? `${formatDate(tx.date)} ${tx.time}` : formatDate(tx.date);
}
