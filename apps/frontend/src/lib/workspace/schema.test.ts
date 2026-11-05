import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkspaceSchema,
  inviteSchema,
  joinWorkspaceSchema,
  updateWorkspaceDetailsSchema,
} from "./schema.ts";

/**
 * The shared workspace schemas: what the form shows inline and what the handler stores
 * must be one rule (AGENTS §6/§7). Money is asserted in minor units — never a float.
 */

test("create parses rupiah text into integer minor units", () => {
  const parsed = createWorkspaceSchema.safeParse({
    name: "  Nikah Ayu & Budi  ",
    weddingDate: "2027-06-03",
    budgetTarget: "50.000.000",
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data, {
    name: "Nikah Ayu & Budi",
    weddingDate: "2027-06-03",
    budgetTargetMinor: 5_000_000_000,
  });
  // Integer, not a float: the value survives JSON and D1 unchanged.
  assert.equal(Number.isSafeInteger(parsed.success && parsed.data.budgetTargetMinor), true);
});

test("create keeps the optional fields optional — an empty form is a valid workspace", () => {
  const parsed = createWorkspaceSchema.safeParse({ name: "Nikah" });
  assert.deepEqual(parsed.success && parsed.data, {
    name: "Nikah",
    weddingDate: null,
    budgetTargetMinor: null,
  });

  const empty = createWorkspaceSchema.safeParse({ name: "Nikah", weddingDate: "", budgetTarget: "" });
  assert.deepEqual(empty.success && empty.data, {
    name: "Nikah",
    weddingDate: null,
    budgetTargetMinor: null,
  });
});

test("create rejects a bad name, a bad date and a bad amount with Bahasa Indonesia copy", () => {
  const cases: [Record<string, string>, string][] = [
    [{ name: "A" }, "Nama workspace minimal 2 karakter."],
    [{ name: "Nikah", weddingDate: "2027-6-3" }, "Tanggal belum benar. Gunakan format YYYY-MM-DD."],
    [{ name: "Nikah", budgetTarget: "banyak" }, "Nominal belum benar. Tulis angka rupiah, misalnya 50.000.000."],
    [{ name: "Nikah", budgetTarget: "50,5" }, "Nominal belum benar. Tulis angka rupiah, misalnya 50.000.000."],
  ];

  for (const [input, message] of cases) {
    const parsed = createWorkspaceSchema.safeParse(input);
    assert.equal(parsed.success, false, JSON.stringify(input));
    assert.equal(parsed.success === false && parsed.error.issues[0]?.message, message);
  }
});

test("join accepts only the 10-character pocket-code structure", () => {
  assert.equal(joinWorkspaceSchema.safeParse({ code: "4821kPz7xQ" }).success, true);
  assert.equal(joinWorkspaceSchema.safeParse({ code: " 4821kPz7xQ " }).success, true, "surrounding spaces are trimmed");

  for (const code of ["", "4821kPz7x", "k4821Pz7x", "4821kPz7x!"]) {
    const parsed = joinWorkspaceSchema.safeParse({ code });
    assert.equal(parsed.success, false, code);
    assert.equal(
      parsed.success === false && parsed.error.issues[0]?.message,
      "Kode undangan harus 10 karakter: 4 angka, 3 huruf, lalu 3 huruf atau angka.",
    );
  }
});

test("details update accepts one field, both, and refuses an empty body", () => {
  const dateOnly = updateWorkspaceDetailsSchema.safeParse({ weddingDate: "2028-01-01" });
  assert.deepEqual(dateOnly.success && dateOnly.data, {
    weddingDate: "2028-01-01",
    budgetTargetMinor: undefined,
  });

  const budgetOnly = updateWorkspaceDetailsSchema.safeParse({ budgetTarget: "10.000.000" });
  assert.deepEqual(budgetOnly.success && budgetOnly.data, {
    weddingDate: undefined,
    budgetTargetMinor: 1_000_000_000,
  });

  const clearing = updateWorkspaceDetailsSchema.safeParse({ weddingDate: "" });
  assert.deepEqual(clearing.success && clearing.data, {
    weddingDate: null,
    budgetTargetMinor: undefined,
  });

  const empty = updateWorkspaceDetailsSchema.safeParse({});
  assert.equal(empty.success, false);
  assert.equal(
    empty.success === false && empty.error.issues[0]?.message,
    "Isi tanggal pernikahan atau target anggaran yang ingin diubah.",
  );
});

test("a missing required field still answers in Bahasa Indonesia", () => {
  const noName = createWorkspaceSchema.safeParse({});
  assert.equal(noName.success === false && noName.error.issues[0]?.message, "Nama workspace wajib diisi.");

  const noCode = joinWorkspaceSchema.safeParse({});
  assert.equal(noCode.success === false && noCode.error.issues[0]?.message, "Kode undangan wajib diisi.");

  const noEmail = inviteSchema.safeParse({});
  assert.equal(noEmail.success === false && noEmail.error.issues[0]?.message, "Email wajib diisi.");
});

test("invite takes the same email rule as sign-up", () => {
  assert.equal(inviteSchema.safeParse({ email: "partner@example.com" }).success, true);
  assert.equal(inviteSchema.safeParse({ email: "bukan-email" }).success, false);
});
