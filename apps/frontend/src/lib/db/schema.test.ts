import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  categories,
  commitments,
  imports,
  members,
  transactions,
  workspaces,
} from "./schema.ts";

const tables = [workspaces, members, categories, imports, transactions, commitments];

test("every money column is 64-bit — P5, never a float, never a JS number", () => {
  let seen = 0;
  for (const table of tables) {
    for (const [name, column] of Object.entries(getTableColumns(table))) {
      if (!name.endsWith("Minor")) continue;
      seen++;
      assert.equal(
        (column as { dataType: string }).dataType,
        "bigint",
        `${getTableName(table)}.${name} must be mode: 'bigint'`,
      );
    }
  }
  assert.ok(seen > 0, "no *Minor columns found — money columns renamed or dropped?");
});

test("money is exact only up to 2^53-1: D1 hands INTEGER back as a JS number", () => {
  // Verified with `wrangler d1 execute DB --local`: inserting 9007199254740993
  // reads back 9007199254740992, while SQLite itself stores it exactly
  // (`v = 9007199254740993` → 1). mode: 'bigint' reads via BigInt(number), so this
  // boundary is the documented supported range (SPEC §10 E4): ~Rp 90 trillion per row.
  assert.equal(BigInt(Number.MAX_SAFE_INTEGER), BigInt("9007199254740991"));
  assert.equal(BigInt(2 ** 53), BigInt("9007199254740992"));
  assert.notEqual(BigInt(2 ** 53 + 1), BigInt("9007199254740993")); // first value lost in transit
});
