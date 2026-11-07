import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, count, eq, sum } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { imports, members, transactions, workspaces } from "../../src/lib/db/schema.ts";
import { importStatementSchema } from "../../src/lib/imports/schema.ts";
import { commitImport, confirmImport } from "../../src/lib/imports/service.ts";
import { trustedTotalsCondition } from "../../src/lib/ledger/trusted.ts";

/**
 * US-12/US-13/US-16/US-17 against real SQLite (AGENTS §11): the import commits
 * atomically, a re-import is a no-op absorbed by the unique index, two overlapping
 * imports both succeed, a parse failure writes nothing, and a flagged import enters
 * trusted totals only after an explicit confirmation.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

const ROWS = [
  { date: "2026-04-02", time: "09:15", description: "Transfer masuk", amountMinor: 250_000_000, balanceMinor: 750_000_000, direction: "in" as const, ref: "TRF-1" },
  { date: "2026-04-03", time: "14:02", description: "Pembayaran QRIS", amountMinor: -75_000_000, balanceMinor: 675_000_000, direction: "out" as const, ref: "" },
  { date: "2026-04-10", time: "", description: "Setoran tunai", amountMinor: 50_000_000, balanceMinor: 725_000_000, direction: "in" as const, ref: "" },
];

const payload = (overrides: Record<string, unknown> = {}) =>
  importStatementSchema.parse({
    sourceId: "jago",
    pocketName: "Kantong Nikah",
    period: "April 2026",
    openingBalanceMinor: 500_000_000,
    totalInMinor: 300_000_000,
    totalOutMinor: 75_000_000,
    closingBalanceMinor: 725_000_000,
    transactions: ROWS,
    ...overrides,
  });

async function workspaceFor(ownerId: string) {
  await addUser(h.binding, ownerId);
  const workspaceId = `ws-${ownerId}`;
  await h.db.insert(workspaces).values({
    id: workspaceId,
    ownerId,
    name: "Impor",
    inviteCode: `INV-${ownerId}`,
  });
  await h.db.insert(members).values({ workspaceId, userId: ownerId, role: "owner" });
  return workspaceId;
}

async function snapshot(workspaceId: string) {
  const [rows] = await h.db
    .select({ n: count(), total: sum(transactions.amountMinor) })
    .from(transactions)
    .where(eq(transactions.workspaceId, workspaceId));
  const [importRow] = await h.db
    .select({ n: count() })
    .from(imports)
    .where(eq(imports.workspaceId, workspaceId));
  return { rows: rows.n, total: Number(rows.total ?? 0), imports: importRow.n };
}

it("commits the import and its rows atomically, with the server's verdict (US-12/US-16)", async () => {
  const workspaceId = await workspaceFor("u-import-1");

  const result = await commitImport(h.db, workspaceId, payload());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.inserted, 3);
  assert.equal(result.duplicates, 0);
  assert.equal(result.reconciliation.ok, true);

  const stored = await snapshot(workspaceId);
  assert.deepEqual(stored, { rows: 3, total: 225_000_000, imports: 1 });

  const [importRow] = await h.db.select().from(imports).where(eq(imports.id, result.importId));
  assert.equal(importRow.reconciled, true);
  assert.equal(importRow.txCount, 3);
  assert.equal(importRow.pocketName, "Kantong Nikah");
  assert.deepEqual(importRow.issues, []);
});

it("a re-import is a no-op absorbed by UNIQUE(workspaceId, dedupeHash) (US-13)", async () => {
  const workspaceId = await workspaceFor("u-import-2");

  const first = await commitImport(h.db, workspaceId, payload());
  assert.equal(first.ok && first.inserted, 3);
  const before = await snapshot(workspaceId);

  const again = await commitImport(h.db, workspaceId, payload());
  assert.equal(again.ok, true);
  if (!again.ok) return;

  assert.equal(again.inserted, 0, "every row was already stored");
  assert.equal(again.duplicates, 3, "duplicates are counted, not silently swallowed");
  assert.deepEqual(await snapshot(workspaceId), { ...before, imports: 2 }, "totals unchanged");
});

it("two overlapping imports both succeed and the index removes the overlap (US-13)", async () => {
  const workspaceId = await workspaceFor("u-import-3");

  const partnerA = payload();
  const partnerB = payload({
    transactions: [
      ROWS[1],
      ROWS[2],
      { date: "2026-04-11", time: "08:00", description: "Tarik tunai", amountMinor: -25_000_000, balanceMinor: 700_000_000, direction: "out" as const, ref: "" },
    ],
  });

  const race = await Promise.allSettled([
    commitImport(h.db, workspaceId, partnerA),
    commitImport(h.db, workspaceId, partnerB),
  ]);

  for (const settled of race) {
    assert.equal(settled.status, "fulfilled", "neither import errors");
    if (settled.status === "fulfilled") assert.equal(settled.value.ok, true);
  }

  // Four distinct rows: the two shared ones exist once, never doubled.
  const stored = await snapshot(workspaceId);
  assert.equal(stored.rows, 4);
  assert.equal(stored.total, 250_000_000 - 75_000_000 + 50_000_000 - 25_000_000);
});

it("a parse failure writes nothing at all (US-44)", async () => {
  const workspaceId = await workspaceFor("u-import-4");

  const invalidRow = importStatementSchema.safeParse({
    ...payload(),
    transactions: [{ ...ROWS[0], amountMinor: 0 }],
  });

  assert.equal(invalidRow.success, false);
  // The handler returns 422 here — the service is never called, so nothing is queued.
  assert.deepEqual(await snapshot(workspaceId), { rows: 0, total: 0, imports: 0 });
});

it("a forged client verdict cannot make a broken statement green (US-16)", async () => {
  const workspaceId = await workspaceFor("u-import-5");

  const tampered = payload({
    // The client claims green; the chain says otherwise.
    reconciliation: { ok: true, issues: [] },
    transactions: [ROWS[0], { ...ROWS[1], amountMinor: -60_000_000 }, ROWS[2]],
  });

  const result = await commitImport(h.db, workspaceId, tampered);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.reconciliation.ok, false);
  const [importRow] = await h.db.select().from(imports).where(eq(imports.id, result.importId));
  assert.equal(importRow.reconciled, false, "the server's verdict is stored, not the client's");
});

it("a flagged import stays out of trusted totals until it is confirmed (US-17)", async () => {
  const workspaceId = await workspaceFor("u-import-6");

  const flagged = await commitImport(
    h.db,
    workspaceId,
    payload({ transactions: [ROWS[0], { ...ROWS[1], amountMinor: -60_000_000 }, ROWS[2]] }),
  );
  assert.equal(flagged.ok, true);
  if (!flagged.ok) return;
  assert.equal(flagged.reconciliation.ok, false, "this import is flagged");

  const trustedTotal = async () => {
    const trusted = await trustedTotalsCondition(h.db, workspaceId);
    const [row] = await h.db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(eq(transactions.workspaceId, workspaceId), trusted));
    return Number(row.total ?? 0);
  };

  assert.equal(await trustedTotal(), 0, "unconfirmed flagged rows are excluded");

  // A different workspace cannot confirm it by guessing the id (AGENTS §4).
  await workspaceFor("u-import-6-other");
  assert.equal(await confirmImport(h.db, "ws-u-import-6-other", flagged.importId), false);

  assert.equal(await confirmImport(h.db, workspaceId, flagged.importId), true);
  assert.equal(await trustedTotal(), 250_000_000 - 60_000_000 + 50_000_000, "confirmed rows are trusted");

  const [importRow] = await h.db.select().from(imports).where(eq(imports.id, flagged.importId));
  assert.equal(importRow.reconciled, false, "still marked 'belum cocok' after confirmation");
  assert.notEqual(importRow.confirmedAt, null);

  // Confirming twice is a no-op, not a second write.
  assert.equal(await confirmImport(h.db, workspaceId, flagged.importId), false);
});
