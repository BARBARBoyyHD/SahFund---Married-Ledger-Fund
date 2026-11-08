import assert from "node:assert/strict";
import test from "node:test";

import { MAX_IMPORT_ROWS, importStatementSchema } from "./schema.ts";

/**
 * The shared import payload schema is a trust boundary (AGENTS §5): the 5,000-row cap
 * and the direction/sign agreement are enforced here for the browser form and the
 * handler alike.
 */

const row = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-04-02",
  time: "",
  description: "Transfer masuk",
  amountMinor: 25_000,
  balanceMinor: 125_000,
  direction: "in",
  ref: "",
  ...overrides,
});

const payload = (overrides: Record<string, unknown> = {}) =>
  importStatementSchema.safeParse({
    sourceId: "jago",
    pocketName: "Kantong Nikah",
    openingBalanceMinor: 100_000,
    totalInMinor: 25_000,
    totalOutMinor: 0,
    closingBalanceMinor: 125_000,
    transactions: [row()],
    ...overrides,
  });

test("a valid payload parses with defaults applied", () => {
  const parsed = payload({ period: undefined, transactions: [row({ time: undefined, ref: undefined })] });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.period, null);
  assert.equal(parsed.data.transactions[0].time, "");
  assert.equal(parsed.data.transactions[0].ref, "");
});

test("the 5,000-row cap is enforced by the schema (US-12)", () => {
  assert.equal(MAX_IMPORT_ROWS, 5_000);

  const tooMany = payload({
    transactions: Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) =>
      row({ balanceMinor: 125_000 + index }),
    ),
  });

  assert.equal(tooMany.success, false);
  if (tooMany.success) return;
  assert.match(tooMany.error.issues[0].message, /5\.000 transaksi/);
});

test("a direction that contradicts the amount sign is refused (US-16)", () => {
  assert.equal(payload({ transactions: [row({ amountMinor: -25_000, direction: "in" })] }).success, false);
  assert.equal(payload({ transactions: [row({ amountMinor: 0, direction: "in" })] }).success, false);
});

test("a malformed row is refused, never coerced", () => {
  assert.equal(payload({ transactions: [row({ date: "02/04/2026" })] }).success, false);
  assert.equal(payload({ transactions: [row({ amountMinor: 25_000.5 })] }).success, false);
  assert.equal(payload({ transactions: [row({ time: "25:00" })] }).success, false);
  assert.equal(payload({ transactions: [] }).success, false);
});
