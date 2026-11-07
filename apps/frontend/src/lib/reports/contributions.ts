import { and, eq, gt, gte, lt, lte, sum } from "drizzle-orm";

import { toMinor } from "../../core/dashboard.ts";
import type { Db } from "../db/index.ts";
import { transactions } from "../db/schema.ts";

/**
 * US-25: money in, money out and net per member, plus the unattributed line (AGENTS §5).
 * The sums are SQL aggregates over the *signed* `amountMinor` (positive = money in) —
 * one `GROUP BY memberId` per direction, never a fetch-all-then-reduce (AGENTS §4).
 * `memberId IS NULL` comes back as its own group and stays a separate line: the report
 * never folds unattributed money into a member's total (spec: Per-member contribution).
 */

/** Inclusive `YYYY-MM-DD` bounds; omitted means "all time". */
export type ContributionRange = { from?: string; to?: string };

export type ContributionLine = {
  /** `null` = the separate "belum ditandai" line. */
  memberId: string | null;
  inMinor: number;
  /** Positive magnitude of money out; `netMinor = inMinor - outMinor`. */
  outMinor: number;
  netMinor: number;
};

/** One grouped row as D1 returns it: `sum()` is text, null when no rows matched. */
export type MemberSumRow = { memberId: string | null; total: string | number | bigint | null };

/**
 * Pure merge of the in/out aggregates. `toMinor` converts through BigInt, so the sum
 * stays exact while it fits the safe-integer range (the form boundary already refuses
 * anything larger — core/money.ts).
 */
export function mergeContributionSums(
  inRows: readonly MemberSumRow[],
  outRows: readonly MemberSumRow[],
): ContributionLine[] {
  const byMember = new Map<string | null, { inMinor: number; outMinor: number }>();

  const line = (memberId: string | null) => {
    let sums = byMember.get(memberId);
    if (!sums) {
      sums = { inMinor: 0, outMinor: 0 };
      byMember.set(memberId, sums);
    }
    return sums;
  };

  for (const row of inRows) line(row.memberId).inMinor += toMinor(row.total);
  for (const row of outRows) line(row.memberId).outMinor += Math.abs(toMinor(row.total));

  return [...byMember.entries()]
    .map(([memberId, sums]) => ({
      memberId,
      inMinor: sums.inMinor,
      outMinor: sums.outMinor,
      netMinor: sums.inMinor - sums.outMinor,
    }))
    .sort((a, b) => {
      if (a.memberId === b.memberId) return 0;
      // Unattributed last, so it reads as the "rest" line the spec asks for.
      if (a.memberId === null) return 1;
      if (b.memberId === null) return -1;
      return a.memberId.localeCompare(b.memberId);
    });
}

export async function contributionReport(
  db: Db,
  workspaceId: string,
  range: ContributionRange = {},
): Promise<ContributionLine[]> {
  const scope = and(
    eq(transactions.workspaceId, workspaceId),
    range.from ? gte(transactions.occurredOn, range.from) : undefined,
    range.to ? lte(transactions.occurredOn, range.to) : undefined,
  );

  // Two indexed aggregates rather than a CASE expression (rule P1: no raw SQL); both let
  // the database group and sum, including the NULL member group.
  const [inRows, outRows] = await Promise.all([
    db
      .select({ memberId: transactions.memberId, total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(scope, gt(transactions.amountMinor, BigInt(0))))
      .groupBy(transactions.memberId),
    db
      .select({ memberId: transactions.memberId, total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(scope, lt(transactions.amountMinor, BigInt(0))))
      .groupBy(transactions.memberId),
  ]);

  return mergeContributionSums(inRows, outRows);
}
