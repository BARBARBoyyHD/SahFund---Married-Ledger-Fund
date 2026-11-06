/**
 * The dashboard's derived figures — pure, clock-free, all money in minor units
 * (AGENTS §5). The server component passes today's Jakarta calendar day in; the
 * functions never read the clock themselves, so they are unit-testable without a DB.
 */

import { MINOR_PER_RUPIAH } from "./money.ts";

/** Whole percent, rounded; 0 when there is no denominator. Unclamped: over-budget reads 102. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Signed change against the month before, or null when there is nothing to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Whole days from `today` to `iso`; 0 on the day, negative after it. */
export function daysUntil(iso: string, today: string): number {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}

/** The Asia/Jakarta calendar day for an instant (UTC+7, no DST). */
export function jakartaDay(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Calendar bounds (`YYYY-MM-DD`, inclusive) of the month in `todayIso` and the one before. */
export function monthBounds(todayIso: string) {
  const [year, month] = todayIso.split("-").map(Number);
  const pad = (value: number) => String(value).padStart(2, "0");
  // Day 0 of the next month is the last day of this one.
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;

  return {
    thisStart: `${year}-${pad(month)}-01`,
    thisEnd: `${year}-${pad(month)}-${pad(lastDay(year, month))}`,
    lastStart: `${previousYear}-${pad(previousMonth)}-01`,
    lastEnd: `${previousYear}-${pad(previousMonth)}-${pad(lastDay(previousYear, previousMonth))}`,
  };
}

/** A SQL `sum()` result (string or number, null when no rows) as safe minor units. */
export function toMinor(value: string | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(BigInt(value));
}

/** An even monthly share per member, rounded up to whole rupiah so the gap is covered. */
export function perMember(minor: number, memberCount: number): number {
  if (memberCount <= 0 || minor <= 0) return 0;
  return Math.ceil(minor / memberCount / MINOR_PER_RUPIAH) * MINOR_PER_RUPIAH;
}
