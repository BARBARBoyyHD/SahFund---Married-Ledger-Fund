import assert from "node:assert/strict";
import test from "node:test";

import { updateCategorySchema } from "./schema.ts";

/**
 * US-22/US-26: the category edit accepts rupiah text and stores integer minor units;
 * an absent field is "unchanged" and an empty budget clears to NULL.
 */

test("budget text becomes integer minor units", () => {
  const parsed = updateCategorySchema.safeParse({ budget: "12.000.000" });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data, { name: undefined, budgetMinor: 1_200_000_000 });
});

test("an empty budget clears it; an absent field leaves it alone", () => {
  const cleared = updateCategorySchema.safeParse({ budget: "" });
  assert.equal(cleared.success && cleared.data.budgetMinor, null);

  const absent = updateCategorySchema.safeParse({ name: "Venue" });
  assert.deepEqual(absent.success && absent.data, { name: "Venue", budgetMinor: undefined });
});

test("name is trimmed and a bad budget is refused in Bahasa Indonesia", () => {
  const named = updateCategorySchema.safeParse({ name: "  Venue  " });
  assert.equal(named.success && named.data.name, "Venue");

  const badBudget = updateCategorySchema.safeParse({ budget: "dua belas juta" });
  assert.equal(badBudget.success, false);
  assert.equal(
    badBudget.success === false && badBudget.error.issues[0]?.message,
    "Anggaran belum benar. Tulis angka rupiah, misalnya 12.000.000.",
  );
});

test("an over-long or blank name is refused", () => {
  for (const [value, message] of [
    ["   ", "Nama kategori wajib diisi."],
    ["x".repeat(61), "Nama kategori maksimal 60 karakter."],
  ] as const) {
    const parsed = updateCategorySchema.safeParse({ name: value });
    assert.equal(parsed.success, false);
    assert.equal(parsed.success === false && parsed.error.issues[0]?.message, message);
  }
});
