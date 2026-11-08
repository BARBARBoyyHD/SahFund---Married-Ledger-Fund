import assert from "node:assert/strict";
import test from "node:test";

import { createManualTransactionSchema, updateTransactionClassificationSchema } from "./schema.ts";

/**
 * US-21: the form and the route handler run this one schema. The request carries rupiah
 * text plus a direction; the parsed row carries signed integer minor units (positive =
 * money in) and nulls for "no category"/"no member".
 */

const valid = {
  occurredOn: "2026-11-06",
  description: "  DP dekorasi tunai  ",
  direction: "out",
  amount: "250.000",
  categoryId: "",
  memberId: "",
} as const;

test("an outgoing row parses to a negative amount in exact minor units", () => {
  const parsed = createManualTransactionSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data, {
    occurredOn: "2026-11-06",
    description: "DP dekorasi tunai",
    direction: "out",
    amountMinor: -25_000_000,
    categoryId: null,
    memberId: null,
  });
  assert.equal(Number.isSafeInteger(parsed.success && parsed.data.amountMinor), true);
});

test("an incoming row parses to a positive amount; omitted options become null", () => {
  const parsed = createManualTransactionSchema.safeParse({
    occurredOn: "2026-11-06",
    description: "Setoran tunai",
    direction: "in",
    amount: "Rp 1.000.000",
  });

  assert.deepEqual(parsed.success && parsed.data, {
    occurredOn: "2026-11-06",
    description: "Setoran tunai",
    direction: "in",
    amountMinor: 100_000_000,
    categoryId: null,
    memberId: null,
  });
});

test("a chosen category and member are kept as ids", () => {
  const parsed = createManualTransactionSchema.safeParse({
    ...valid,
    categoryId: "cat-1",
    memberId: "user-1",
  });

  assert.equal(parsed.success && parsed.data.categoryId, "cat-1");
  assert.equal(parsed.success && parsed.data.memberId, "user-1");
});

test("missing required fields are rejected with Bahasa Indonesia copy", () => {
  const cases: [Record<string, string>, string][] = [
    [{ ...valid, occurredOn: "" }, "Tanggal wajib diisi."],
    [{ ...valid, occurredOn: "06-11-2026" }, "Tanggal belum benar. Gunakan format YYYY-MM-DD."],
    [{ ...valid, description: "   " }, "Deskripsi wajib diisi."],
    [{ ...valid, amount: "" }, "Nominal wajib diisi."],
    [
      { ...valid, amount: "banyak" },
      "Nominal belum benar. Tulis angka rupiah lebih dari nol, misalnya 250.000.",
    ],
    [
      { ...valid, amount: "0" },
      "Nominal belum benar. Tulis angka rupiah lebih dari nol, misalnya 250.000.",
    ],
    [
      { ...valid, amount: "250,5" },
      "Nominal belum benar. Tulis angka rupiah lebih dari nol, misalnya 250.000.",
    ],
    [{ ...valid, direction: "masuk" }, "Pilih jenis transaksi."],
  ];

  for (const [input, message] of cases) {
    const parsed = createManualTransactionSchema.safeParse(input);
    assert.equal(parsed.success, false, JSON.stringify(input));
    assert.equal(parsed.success === false && parsed.error.issues[0]?.message, message);
  }
});

test("a description over 200 characters is rejected", () => {
  const parsed = createManualTransactionSchema.safeParse({
    ...valid,
    description: "x".repeat(201),
  });
  assert.equal(parsed.success, false);
  assert.equal(
    parsed.success === false && parsed.error.issues[0]?.message,
    "Deskripsi maksimal 200 karakter.",
  );
});

/**
 * US-20 re-categorise: an imported row's PATCH may only touch classification. The
 * statement facts in a tampered payload are stripped, not written.
 */
test("an imported-row patch keeps classification and drops statement facts", () => {
  const parsed = updateTransactionClassificationSchema.safeParse({
    categoryId: "cat-1",
    memberId: "user-1",
    occurredOn: "2020-01-01",
    description: "tampered",
    amount: "1",
    direction: "in",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.categoryId, "cat-1");
  assert.equal(parsed.data.memberId, "user-1");
  for (const key of ["occurredOn", "description", "amount", "direction"]) {
    assert.equal(key in parsed.data, false, key);
  }
});

test("an empty string clears a reference; an omitted field stays unchanged", () => {
  const cleared = updateTransactionClassificationSchema.safeParse({ categoryId: "" });
  assert.equal(cleared.success, true);
  assert.equal(cleared.success && cleared.data.categoryId, null);

  const untouched = updateTransactionClassificationSchema.safeParse({});
  assert.equal(untouched.success, true);
  assert.equal(untouched.success && untouched.data.categoryId, undefined);
  assert.equal(untouched.success && untouched.data.memberId, undefined);
});

test("a non-string reference is rejected with Bahasa Indonesia copy", () => {
  const parsed = updateTransactionClassificationSchema.safeParse({ categoryId: 42 });
  assert.equal(parsed.success, false);
  assert.equal(
    parsed.success === false && parsed.error.issues[0]?.message,
    "Pilihan tidak valid.",
  );
});
