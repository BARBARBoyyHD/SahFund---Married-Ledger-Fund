/**
 * US-30 / design decision 6: surface payments that look counted twice. Pure — no clock,
 * no db — so the report and its tests share one rule.
 *
 * A "paid" amount on a commitment is stored positive; a vendor payment in the ledger is
 * money out (negative `amountMinor`), so the match requires a money-out row whose
 * magnitude equals the payment and whose day distance is ≤ 3 days either way. This is a
 * *suggestion* only: the caller shows the pairs next to the report and states which
 * figure is counted in totals — nothing is merged, adjusted, or removed here (spec:
 * Payments counted twice are surfaced visibly).
 */

/** ± days tolerated between the commitment payment date and the ledger row. */
export const DUPLICATE_PAYMENT_WINDOW_DAYS = 3;

const DAY_MS = 86_400_000;

export type CommitmentPayment = {
  commitmentId: string;
  /** Calendar date the commitment recorded the payment, `YYYY-MM-DD`. */
  paidOn: string;
  /** Positive magnitude, minor units. */
  amountMinor: number;
};

export type LedgerPayment = {
  transactionId: string;
  /** Calendar date of the ledger row, `YYYY-MM-DD`. */
  occurredOn: string;
  /** Signed ledger amount (positive = money in); only the magnitude is compared. */
  amountMinor: number;
};

export type DuplicatePaymentPair = {
  commitmentId: string;
  transactionId: string;
  /** The matched magnitude, minor units. */
  amountMinor: number;
};

function dayDistance(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY;
  return Math.abs(first - second) / DAY_MS;
}

/**
 * Every (commitment payment, ledger row) pair with an equal magnitude inside the window.
 * Returned in input order for a stable report. O(payments × ledger) is fine at v1.0 scale
 * (a handful of commitments); index by amount only if a workspace ever has thousands.
 */
export function matchDuplicatePayments(
  payments: readonly CommitmentPayment[],
  ledger: readonly LedgerPayment[],
  windowDays: number = DUPLICATE_PAYMENT_WINDOW_DAYS,
): DuplicatePaymentPair[] {
  const pairs: DuplicatePaymentPair[] = [];

  for (const payment of payments) {
    const amount = Math.abs(payment.amountMinor);
    // A zero amount says nothing about duplication — it would match every empty row.
    if (amount === 0) continue;

    for (const entry of ledger) {
      // A payment leaves the account, so only a money-out row can be the duplicate.
      if (entry.amountMinor >= 0 || -entry.amountMinor !== amount) continue;
      if (dayDistance(payment.paidOn, entry.occurredOn) > windowDays) continue;

      pairs.push({
        commitmentId: payment.commitmentId,
        transactionId: entry.transactionId,
        amountMinor: amount,
      });
    }
  }

  return pairs;
}
