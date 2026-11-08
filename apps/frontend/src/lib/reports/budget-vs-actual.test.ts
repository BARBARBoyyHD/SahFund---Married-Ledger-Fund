import assert from "node:assert/strict";
import test from "node:test";

import { mergeBudgetVsActual } from "./budget-vs-actual.ts";

test("over-budget is marked unclamped: remaining stays negative", () => {
  const report = mergeBudgetVsActual(
    [{ id: "cat-venue", name: "Venue", budgetMinor: BigInt(30000000) }],
    [{ categoryId: "cat-venue", total: "30000000", paid: "30500000" }],
  );

  assert.deepEqual(report.rows, [
    {
      categoryId: "cat-venue",
      name: "Venue",
      budgetMinor: 30000000,
      committedMinor: 30000000,
      paidMinor: 30500000,
      remainingMinor: -500000,
      overBudget: true,
    },
  ]);
  assert.equal(report.totals.remainingMinor, -500000);
  assert.equal(report.totals.overBudget, true);
});

test("a category without a budget keeps remaining blank but still counts in totals", () => {
  const report = mergeBudgetVsActual(
    [
      { id: "cat-venue", name: "Venue", budgetMinor: BigInt(10000000) },
      { id: "cat-decor", name: "Dekorasi", budgetMinor: null },
    ],
    [
      { categoryId: "cat-venue", total: "9000000", paid: "8000000" },
      { categoryId: "cat-decor", total: "5000000", paid: "5000000" },
    ],
  );

  const decor = report.rows.find((row) => row.categoryId === "cat-decor");
  assert.equal(decor?.budgetMinor, null);
  assert.equal(decor?.remainingMinor, null);
  assert.equal(decor?.overBudget, false);

  // Both figures reach the totals row even though one category has no budget.
  assert.deepEqual(report.totals, {
    budgetMinor: 10000000,
    committedMinor: 14000000,
    paidMinor: 13000000,
    remainingMinor: -3000000,
    overBudget: true,
  });
});

test("commitments without a category become one 'Belum kategori' row and stay in totals", () => {
  const report = mergeBudgetVsActual(
    [{ id: "cat-catering", name: "Catering", budgetMinor: BigInt(20000000) }],
    [
      { categoryId: "cat-catering", total: "15000000", paid: "10000000" },
      { categoryId: null, total: "4000000", paid: "1500000" },
    ],
  );

  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows[1], {
    categoryId: null,
    name: null,
    budgetMinor: null,
    committedMinor: 4000000,
    paidMinor: 1500000,
    remainingMinor: null,
    overBudget: false,
  });
  assert.equal(report.totals.committedMinor, 19000000);
  assert.equal(report.totals.paidMinor, 11500000);
  assert.equal(report.totals.remainingMinor, 8500000);
});

test("no categories and no commitments yields empty rows and a zero totals row", () => {
  const report = mergeBudgetVsActual([], []);
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.totals, {
    budgetMinor: 0,
    committedMinor: 0,
    paidMinor: 0,
    remainingMinor: 0,
    overBudget: false,
  });
});
