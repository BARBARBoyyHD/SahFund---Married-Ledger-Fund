import assert from "node:assert/strict";
import test from "node:test";

import { CATEGORY_KIND, SEED_CATEGORY_NAMES, missingCategoryRows, seedCategoryRows } from "./wedding-category-seed.ts";

/**
 * US-22 / BRD FR-06: a new workspace starts with exactly the ten seeded categories,
 * named and ordered as the BRD writes them.
 */

const BRD_NAMES = [
  "Catering",
  "Venue",
  "Dekorasi",
  "Busana & Rias",
  "Dokumentasi",
  "Undangan & Souvenir",
  "Seserahan & Mahar",
  "Adat & Prosesi",
  "Transportasi",
  "Lain-lain",
];

test("the seed is exactly the BRD FR-06 set, in order, with no duplicates", () => {
  assert.deepEqual([...SEED_CATEGORY_NAMES], BRD_NAMES);
  assert.equal(new Set(SEED_CATEGORY_NAMES).size, BRD_NAMES.length);
});

test("seed rows carry sort 1..10 and the one documented kind", () => {
  const rows = seedCategoryRows("ws-1");
  assert.equal(rows.length, 10);
  assert.deepEqual(
    rows.map((row) => row.sort),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(
    rows.every((row) => row.workspaceId === "ws-1" && row.kind === CATEGORY_KIND),
    true,
  );
  assert.equal(new Set(rows.map((row) => row.id)).size, 10);
});

test("the backfill returns only the names a workspace is missing, in seed order", () => {
  const rows = missingCategoryRows("ws-1", ["Catering", "Lain-lain"]);

  assert.deepEqual(
    rows.map((row) => row.name),
    BRD_NAMES.filter((name) => name !== "Catering" && name !== "Lain-lain"),
  );
  assert.deepEqual(
    rows.map((row) => row.sort),
    [2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.equal(
    rows.every((row) => row.workspaceId === "ws-1" && row.kind === CATEGORY_KIND),
    true,
  );
});

test("a workspace with all ten categories needs no backfill", () => {
  assert.deepEqual(missingCategoryRows("ws-1", [...SEED_CATEGORY_NAMES]), []);
});

test("duplicate or unknown existing names do not affect the gap", () => {
  const rows = missingCategoryRows("ws-1", ["Catering", "Catering", "Kategori Lama"]);
  assert.deepEqual(
    rows.map((row) => row.name),
    BRD_NAMES.filter((name) => name !== "Catering"),
  );
});
