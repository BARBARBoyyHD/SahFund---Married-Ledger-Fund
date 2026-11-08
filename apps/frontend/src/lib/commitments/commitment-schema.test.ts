import assert from "node:assert/strict";
import test from "node:test";

import { createCommitmentSchema, updateCommitmentSchema } from "./commitment-schema.ts";

/**
 * US-28 / BRD FR-09: the form and the handler share this schema. Money is stored as
 * integer minor units; status is derived from paid vs total, never trusted from input.
 */

const valid = {
  vendor: "  Nirmala Décor  ",
  categoryId: "",
  total: "30.000.000",
  paid: "5.000.000",
  dueOn: "2027-01-15",
} as const;

test("a partial contract parses to minor units and a derived status", () => {
  const parsed = createCommitmentSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data, {
    vendor: "Nirmala Décor",
    categoryId: null,
    totalMinor: 3_000_000_000,
    paidMinor: 500_000_000,
    dueOn: "2027-01-15",
    status: "partial",
  });
});

test("an empty paid field means zero and status unpaid", () => {
  const parsed = createCommitmentSchema.safeParse({
    ...valid,
    paid: "",
    dueOn: "",
  });

  assert.deepEqual(parsed.success && parsed.data, {
    vendor: "Nirmala Décor",
    categoryId: null,
    totalMinor: 3_000_000_000,
    paidMinor: 0,
    dueOn: null,
    status: "unpaid",
  });
});

test("paid equal to total is Lunas, and a chosen category is kept", () => {
  const parsed = createCommitmentSchema.safeParse({
    ...valid,
    paid: "30.000.000",
    categoryId: "cat-1",
  });

  assert.equal(parsed.success && parsed.data.status, "paid");
  assert.equal(parsed.success && parsed.data.categoryId, "cat-1");
});

test("missing vendor or total is rejected with Bahasa Indonesia copy", () => {
  const cases: [Record<string, string>, string][] = [
    [{ ...valid, vendor: "   " }, "Vendor wajib diisi."],
    [{ ...valid, total: "" }, "Total wajib diisi."],
    [
      { ...valid, total: "banyak" },
      "Total belum benar. Tulis angka rupiah lebih dari nol, misalnya 30.000.000.",
    ],
    [
      { ...valid, total: "0" },
      "Total belum benar. Tulis angka rupiah lebih dari nol, misalnya 30.000.000.",
    ],
    [
      { ...valid, total: "30.000.000,50" },
      "Total belum benar. Tulis angka rupiah lebih dari nol, misalnya 30.000.000.",
    ],
    [
      { ...valid, paid: "banyak" },
      "Nominal terbayar belum benar. Tulis angka rupiah, misalnya 5.000.000.",
    ],
    [{ ...valid, dueOn: "15-01-2027" }, "Tanggal belum benar. Gunakan format YYYY-MM-DD."],
  ];

  for (const [input, message] of cases) {
    const parsed = createCommitmentSchema.safeParse(input);
    assert.equal(parsed.success, false, JSON.stringify(input));
    assert.equal(parsed.success === false && parsed.error.issues[0]?.message, message);
  }
});

test("paid may not exceed the contract total, and the error sits on the paid field", () => {
  const parsed = createCommitmentSchema.safeParse({ ...valid, paid: "31.000.000" });
  assert.equal(parsed.success, false);
  const issue = parsed.success === false ? parsed.error.issues[0] : undefined;
  assert.equal(issue?.path[0], "paid");
  assert.equal(issue?.message, "Nominal terbayar tidak boleh melebihi total.");
});

test("a vendor over 120 characters is rejected", () => {
  const parsed = createCommitmentSchema.safeParse({ ...valid, vendor: "x".repeat(121) });
  assert.equal(parsed.success, false);
  assert.equal(
    parsed.success === false && parsed.error.issues[0]?.message,
    "Nama vendor maksimal 120 karakter.",
  );
});

test("a settlement update derives status from total and paid", () => {
  const partial = updateCommitmentSchema.safeParse({ total: "30.000.000", paid: "5.000.000" });
  assert.deepEqual(partial.success && partial.data, {
    totalMinor: 3_000_000_000,
    paidMinor: 500_000_000,
    // Omitted dueOn is not sent to the UPDATE — a settlement never wipes a due date.
    dueOn: undefined,
    status: "partial",
  });

  const paidOff = updateCommitmentSchema.safeParse({ total: "30.000.000", paid: "30.000.000" });
  assert.equal(paidOff.success && paidOff.data.status, "paid");

  const unpaid = updateCommitmentSchema.safeParse({ total: "30.000.000", paid: "" });
  assert.equal(unpaid.success && unpaid.data.status, "unpaid");
});

test("dueOn: an explicit date is set, an empty string clears it", () => {
  const dated = updateCommitmentSchema.safeParse({
    total: "30.000.000",
    paid: "0",
    dueOn: "2027-01-15",
  });
  assert.equal(dated.success && dated.data.dueOn, "2027-01-15");

  const cleared = updateCommitmentSchema.safeParse({ total: "30.000.000", paid: "0", dueOn: "" });
  assert.equal(cleared.success && cleared.data.dueOn, null);
});

test("a settlement may exceed the contract total — overage is stored, not clamped", () => {
  const parsed = updateCommitmentSchema.safeParse({ total: "30.000.000", paid: "31.000.000" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.paidMinor, 3_100_000_000);
  assert.equal(parsed.success && parsed.data.status, "paid");
});
