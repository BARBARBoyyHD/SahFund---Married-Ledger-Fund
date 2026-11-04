/**
 * FR-10 forecast. Pure: no I/O, no clock of its own, all money in minor units.
 * Returns one sentence's worth of answer: funded or short, by how much, and what to set aside monthly.
 */

import { MINOR_PER_RUPIAH } from "./money.ts";

export type ForecastInput = {
  balanceMinor: number;
  committedUnpaidMinor: number;
  remainingBudgetMinor: number;
  plannedMonthlyDepositMinor: number;
  weddingDate: Date;
  today: Date;
};

export type Forecast = {
  status: "funded" | "shortfall";
  /** Money still owed on the wedding after the projected deposits. 0 when funded. */
  shortfallAmountMinor: number;
  /** Even monthly deposit that closes the gap. 0 when funded. */
  requiredMonthlyDepositMinor: number;
  /** Whole months from today to the wedding, never below 1. */
  monthsLeft: number;
  projectedMinor: number;
  needMinor: number;
};

export function monthsUntil(weddingDate: Date, today: Date): number {
  const months =
    (weddingDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (weddingDate.getUTCMonth() - today.getUTCMonth());
  const notFullMonth = weddingDate.getUTCDate() < today.getUTCDate();
  return Math.max(1, notFullMonth ? months - 1 : months);
}

export function forecast({
  balanceMinor,
  committedUnpaidMinor,
  remainingBudgetMinor,
  plannedMonthlyDepositMinor,
  weddingDate,
  today,
}: ForecastInput): Forecast {
  const needMinor = Math.max(0, committedUnpaidMinor + remainingBudgetMinor);
  const monthsLeft = monthsUntil(weddingDate, today);
  const projectedMinor = balanceMinor + plannedMonthlyDepositMinor * monthsLeft;
  const gapMinor = Math.max(0, needMinor - projectedMinor);
  const toSaveMinor = Math.max(0, needMinor - balanceMinor);

  return {
    status: gapMinor === 0 ? "funded" : "shortfall",
    shortfallAmountMinor: gapMinor,
    requiredMonthlyDepositMinor:
      gapMinor === 0
        ? 0
        : Math.ceil(toSaveMinor / monthsLeft / MINOR_PER_RUPIAH) * MINOR_PER_RUPIAH,
    monthsLeft,
    projectedMinor,
    needMinor,
  };
}
