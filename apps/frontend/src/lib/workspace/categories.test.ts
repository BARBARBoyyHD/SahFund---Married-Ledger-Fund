import assert from "node:assert/strict";
import test from "node:test";

import { CATEGORY_KIND, SEED_CATEGORY_NAMES, seedCategoryRows } from "./categories.ts";

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
