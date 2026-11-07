import { asc, eq, sum } from "drizzle-orm";

import { toMinor } from "../../core/dashboard.ts";
import type { Db } from "../db/index.ts";
import { categories, commitments } from "../db/schema.ts";

/**
 * US-27: budget, committed, paid and remaining per category, plus a totals row. Two
 * queries — categories in sort order, and one `GROUP BY categoryId` over commitments —
 * then a pure merge; never a query per category (AGENTS §4).
 *
 * `remaining = budget - paid` (money already spent against the budget, not the signed
 * contracts: those are the `committed` column). It is deliberately **unclamped**, so an
 * over-budget category shows a negative remaining and `overBudget = true` — never
 * `Math.max(0, …)` (spec: Over-budget is visible).
 *
 * A category without a budget keeps `budgetMinor = null` and `remainingMinor = null`
 * (the UI shows a blank, not a fake zero). Commitments with no category — or, defensive-
 * ly, with a category foreign to this workspace — collapse into one "Belum kategori"
 * row (`name: null`) so their money still reaches the totals row.
 */

export type BudgetVsActualRow = {
  /** `null` = the "Belum kategori" row. */
  categoryId: string | null;
  name: string | null;
  /** `null` = no budget set for this category. */
  budgetMinor: number | null;
  committedMinor: number;
  paidMinor: number;
  /** `budgetMinor - paidMinor`; `null` when there is no budget. Negative = over budget. */
  remainingMinor: number | null;
  overBudget: boolean;
};

export type BudgetVsActualTotals = {
  budgetMinor: number;
  committedMinor: number;
  paidMinor: number;
  remainingMinor: number;
  overBudget: boolean;
};

export type BudgetVsActualReport = {
  rows: BudgetVsActualRow[];
  totals: BudgetVsActualTotals;
};

/** A category as stored (`numeric({ mode: 'bigint' })` reads back as bigint). */
export type CategoryBudgetRow = {
  id: string;
  name: string;
  budgetMinor: string | number | bigint | null;
};

/** One `GROUP BY categoryId` row over commitments. */
export type CommitmentSumRow = {
  categoryId: string | null;
  total: string | null;
  paid: string | null;
};

export function mergeBudgetVsActual(
  categoryRows: readonly CategoryBudgetRow[],
  commitmentRows: readonly CommitmentSumRow[],
): BudgetVsActualReport {
  const byCategory = new Map(commitmentRows.map((row) => [row.categoryId, row]));
  const knownCategoryIds = new Set(categoryRows.map((row) => row.id));

  const rows: BudgetVsActualRow[] = categoryRows.map((category) => {
    const agg = byCategory.get(category.id);
    const budgetMinor = category.budgetMinor === null ? null : toMinor(category.budgetMinor);
    const committedMinor = toMinor(agg?.total);
    const paidMinor = toMinor(agg?.paid);
    const remainingMinor = budgetMinor === null ? null : budgetMinor - paidMinor;

    return {
      categoryId: category.id,
      name: category.name,
      budgetMinor,
      committedMinor,
      paidMinor,
      remainingMinor,
      overBudget: remainingMinor !== null && remainingMinor < 0,
    };
  });

  const unrouted = commitmentRows.filter(
    (row) => row.categoryId === null || !knownCategoryIds.has(row.categoryId),
  );
  if (unrouted.length > 0) {
    rows.push({
      categoryId: null,
      name: null,
      budgetMinor: null,
      committedMinor: unrouted.reduce((total, row) => total + toMinor(row.total), 0),
      paidMinor: unrouted.reduce((total, row) => total + toMinor(row.paid), 0),
      remainingMinor: null,
      overBudget: false,
    });
  }

  const budgetMinor = rows.reduce((total, row) => total + (row.budgetMinor ?? 0), 0);
  const committedMinor = rows.reduce((total, row) => total + row.committedMinor, 0);
  const paidMinor = rows.reduce((total, row) => total + row.paidMinor, 0);
  const remainingMinor = budgetMinor - paidMinor;

  return {
    rows,
    totals: {
      budgetMinor,
      committedMinor,
      paidMinor,
      remainingMinor,
      overBudget: remainingMinor < 0,
    },
  };
}

export async function budgetVsActualReport(
  db: Db,
  workspaceId: string,
): Promise<BudgetVsActualReport> {
  const [categoryRows, commitmentRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, budgetMinor: categories.budgetMinor })
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId))
      .orderBy(asc(categories.sort), asc(categories.name)),
    db
      .select({
        categoryId: commitments.categoryId,
        total: sum(commitments.totalMinor),
        paid: sum(commitments.paidMinor),
      })
      .from(commitments)
      .where(eq(commitments.workspaceId, workspaceId))
      .groupBy(commitments.categoryId),
  ]);

  return mergeBudgetVsActual(categoryRows, commitmentRows);
}
