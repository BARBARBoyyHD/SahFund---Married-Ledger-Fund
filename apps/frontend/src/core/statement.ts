/**
 * The canonical, bank-agnostic statement (ITA §4.2, ADR-06). Adapters emit it,
 * `reconcile` consumes it, and nothing downstream knows which bank produced it.
 *
 * Money is integer minor units, the same `number` shape `money.ts` formats and
 * `forecast.ts` sums — always a whole integer, never a fraction.
 *
 * `line`/`raw` exist for the browser's "offending line" report (US-44) and are never
 * posted to the server: only derived rows leave the device (NFR-01).
 */

export type StatementDirection = "in" | "out";

export type StatementTransaction = {
  /** `YYYY-MM-DD`, the column's stored form. */
  date: string;
  /** `HH:mm`; empty when the statement prints no time. */
  time: string;
  description: string;
  /** Signed: positive = money in. */
  amountMinor: number;
  /** The printed running balance after this row. */
  balanceMinor: number;
  direction: StatementDirection;
  /** Bank reference; empty when the statement has none. */
  ref: string;
  /** 1-based line in the extracted text. */
  line?: number;
  /** The source line itself, for the parse/reconciliation error message. */
  raw?: string;
};

export type StatementPocket = {
  name: string;
  pocketId?: string;
  openingBalanceMinor: number;
  totalInMinor: number;
  totalOutMinor: number;
  closingBalanceMinor: number;
  transactions: StatementTransaction[];
};

export type Statement = {
  bank: string;
  kind: "pdf-text" | "csv";
  accountName?: string;
  accountNo?: string;
  period?: string;
  pockets: StatementPocket[];
};

export type StatementSourceInput = { kind: "pdf-text" | "csv"; text: string; hint?: string };

/** The interface every adapter satisfies (ITA §4.2) — `canParse` then `parse`. */
export type StatementSource = {
  id: string;
  label: string;
  priority: number;
  canParse(input: StatementSourceInput): boolean;
  parse(input: StatementSourceInput): Statement;
};

/**
 * A parse failure the browser renders verbatim, in Bahasa Indonesia, naming the
 * offending line (US-44). Distinct from a reconciliation failure: this one persists
 * nothing at all (design decision 7).
 */
export class StatementParseError extends Error {
  readonly line?: number;
  readonly raw?: string;

  constructor(message: string, detail: { line?: number; raw?: string } = {}) {
    super(message);
    this.name = "StatementParseError";
    this.line = detail.line;
    this.raw = detail.raw;
  }
}

/**
 * The pinned dedupe tuple's statement-side fields, in order:
 * `date | time | amountMinor | balanceMinor | ref` (ERD §5 / ITA §5).
 *
 * `core/dedupe.ts` prefixes the workspace id and hashes this string, so the hash and
 * the in-statement duplicate check cannot drift apart. Deliberately crypto-free: the
 * browser preview imports this module, and `node:crypto` has no place in a client leaf.
 */
export function transactionTuple(
  tx: Pick<StatementTransaction, "date" | "time" | "amountMinor" | "balanceMinor" | "ref">,
): string {
  return [tx.date, tx.time, String(tx.amountMinor), String(tx.balanceMinor), tx.ref].join("|");
}
