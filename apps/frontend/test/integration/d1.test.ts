import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq, lte, sql } from "drizzle-orm";
import { startD1, runImportBatch, addUser } from "../helpers/d1.ts";
import {
  categories,
  imports,
  members,
  rateLimits,
  transactions,
  user,
  workspaces,
} from "../../src/lib/db/schema.ts";

/**
 * Integration tests against a local D1 (SPEC-d1-migration §9, T7).
 *
 * Run with `npm run test:integration` — real SQLite (workerd), committed
 * migrations, no Cloudflare account and no network.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

/** Drizzle wraps driver errors: the SQLite message lives on `cause`. */
function driverMessage(error: unknown) {
  const cause = (error as { cause?: { message?: string } }).cause;
  return cause?.message ?? (error as Error).message;
}

it("applies the committed migrations and answers a probe", async () => {
  const probe = await h.binding.prepare("select 1 as ok").all<{ ok: number }>();
  assert.equal(probe.results[0].ok, 1);

  // Every table in the schema is queryable, i.e. the migration really ran.
  for (const table of [workspaces, members, categories, imports, transactions, rateLimits]) {
    assert.deepEqual(await h.db.select().from(table), []);
  }
});

it("rolls back the whole batch when a later statement fails (R2 — the atomicity authority)", async () => {
  await addUser(h.binding, "u-atomic");
  await addUser(h.binding, "u-atomic-2");
  const error = await h.db
    .batch([
      h.db.insert(workspaces).values({ id: "ws-atomic", ownerId: "u-atomic", name: "A", inviteCode: "INV-ATOMIC" }),
      h.db.insert(categories).values({ workspaceId: "ws-atomic", name: "Venue", kind: "expense", sort: 1 }),
      // Third statement violates UNIQUE(workspaces.inviteCode).
      h.db.insert(workspaces).values({ ownerId: "u-atomic-2", name: "B", inviteCode: "INV-ATOMIC" }),
    ])
    .then(
      () => assert.fail("the batch should have failed"),
      (e: unknown) => e,
    );

  assert.match(driverMessage(error), /UNIQUE constraint failed: workspaces\.inviteCode/);
  // Neither statement before the failure survived: no partial import is possible.
  assert.deepEqual(await h.db.select().from(categories).where(eq(categories.workspaceId, "ws-atomic")), []);
  assert.deepEqual(await h.db.select().from(workspaces).where(eq(workspaces.ownerId, "u-atomic")), []);
});

it("stores a 5,000-row import in a single batch inside workerd (R3, BRD FR-03)", async () => {
  const result = await runImportBatch(5000);

  assert.equal(result.statements, 5001, "one import row + 5,000 transaction rows, one batch");
  assert.equal(result.stored, 5000);
  assert.equal(result.txCount, 5000);
  // -1000 - i for i = 0..4999 → exact integer sum, no float in the path.
  assert.equal(result.totalMinor, -17_497_500);
  assert.ok(result.ms < 30_000, `batch took ${result.ms}ms, D1 caps a batch call at 30s`);
});

it("rejects a second owner in the same workspace and rolls the batch back (E10)", async () => {
  await addUser(h.binding, "u-owner");
  await addUser(h.binding, "u-second");
  await h.db.insert(workspaces).values({ id: "ws-cap", ownerId: "u-owner", name: "Cap", inviteCode: "INV-CAP" });
  await h.db.insert(members).values({ workspaceId: "ws-cap", userId: "u-owner", role: "owner" });

  const error = await h.db
    .batch([
      h.db.insert(members).values({ workspaceId: "ws-cap", userId: "u-second", role: "owner" }),
      h.db.insert(categories).values({ workspaceId: "ws-cap", name: "Catering", kind: "expense", sort: 1 }),
    ])
    .then(
      () => assert.fail("UNIQUE(workspaceId, role) should have fired"),
      (e: unknown) => e,
    );

  assert.match(driverMessage(error), /UNIQUE constraint failed: members\.workspaceId, members\.role/);
  assert.deepEqual(await h.db.select().from(categories).where(eq(categories.workspaceId, "ws-cap")), []);
  assert.equal((await h.db.select().from(members).where(eq(members.workspaceId, "ws-cap"))).length, 1);
});

it("rejects a role outside owner/member via the CHECK constraint", async () => {
  await addUser(h.binding, "u-role");
  await addUser(h.binding, "u-admin");
  await h.db.insert(workspaces).values({ id: "ws-role", ownerId: "u-role", name: "Role", inviteCode: "INV-ROLE" });

  await assert.rejects(
    h.db.insert(members).values({ workspaceId: "ws-role", userId: "u-admin", role: "admin" }),
    (e: unknown) => /CHECK constraint failed: members_role_check/.test(driverMessage(e)),
  );
  assert.deepEqual(await h.db.select().from(members).where(eq(members.workspaceId, "ws-role")), []);
});

it("rejects a duplicate (workspaceId, dedupeHash) and rolls the batch back", async () => {
  await addUser(h.binding, "u-dedupe");
  await h.db.insert(workspaces).values({ id: "ws-dedupe", ownerId: "u-dedupe", name: "Dedupe", inviteCode: "INV-DEDUPE" });
  const row = (dedupeHash: string) => ({
    workspaceId: "ws-dedupe",
    occurredOn: "2026-11-01",
    description: "Transfer",
    amountMinor: BigInt(-50_000),
    balanceMinor: BigInt(1_000_000),
    direction: "out",
    source: "jago",
    dedupeHash,
  });
  await h.db.insert(transactions).values(row("hash-a"));

  const error = await h.db
    .batch([h.db.insert(transactions).values(row("hash-b")), h.db.insert(transactions).values(row("hash-a"))])
    .then(
      () => assert.fail("UNIQUE(workspaceId, dedupeHash) should have fired"),
      (e: unknown) => e,
    );

  assert.match(driverMessage(error), /UNIQUE constraint failed: transactions\.workspaceId, transactions\.dedupeHash/);
  // Only the row written before the batch survives — re-import can never double a balance.
  const stored = await h.db.select().from(transactions).where(eq(transactions.workspaceId, "ws-dedupe"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].dedupeHash, "hash-a");
});

it("surfaces unique violations in the shape classifyError() detects (P3 contract)", async () => {
  // `classifyError()` (src/lib/db/index.ts) parses exactly this driver contract: D1
  // reports `D1_ERROR: UNIQUE constraint failed: <table>.<column>: SQLITE_CONSTRAINT
  // (extended: SQLITE_CONSTRAINT_UNIQUE)`, and the CHECK error never matches.
  await addUser(h.binding, "u-shape");
  await addUser(h.binding, "u-shape-2");
  await addUser(h.binding, "u-shape-3");
  await h.db.insert(workspaces).values({ ownerId: "u-shape", name: "Shape", inviteCode: "INV-SHAPE" });

  const unique = await h.db
    .insert(workspaces)
    .values({ ownerId: "u-shape-2", name: "Shape 2", inviteCode: "INV-SHAPE" })
    .then(
      () => assert.fail("expected a unique violation"),
      (e: unknown) => driverMessage(e),
    );
  assert.match(unique, /UNIQUE constraint failed: workspaces\.inviteCode/);
  assert.match(unique, /SQLITE_CONSTRAINT_UNIQUE/);

  await h.db.insert(workspaces).values({ id: "ws-shape", ownerId: "u-shape-3", name: "Shape 3", inviteCode: "INV-SHAPE-3" });
  const check = await h.db
    .insert(members)
    .values({ workspaceId: "ws-shape", userId: "u-shape", role: "admin" })
    .then(
      () => assert.fail("expected a check violation"),
      (e: unknown) => driverMessage(e),
    );
  assert.match(check, /CHECK constraint failed/);
  assert.doesNotMatch(check, /UNIQUE/);
});

it("enforces the 0002 FKs: RESTRICT on the owner, SET NULL on attribution (ERD §4 #4, #13)", async () => {
  await addUser(h.binding, "u-fk-owner");
  await addUser(h.binding, "u-fk-member");
  await h.db.insert(workspaces).values({ id: "ws-fk", ownerId: "u-fk-owner", name: "FK", inviteCode: "INV-FK" });
  await h.db.insert(members).values([
    { workspaceId: "ws-fk", userId: "u-fk-owner", role: "owner" },
    { workspaceId: "ws-fk", userId: "u-fk-member", role: "member" },
  ]);
  await h.db.insert(transactions).values({
    workspaceId: "ws-fk",
    memberId: "u-fk-member",
    occurredOn: "2026-11-01",
    description: "Attributed",
    amountMinor: BigInt(-1),
    balanceMinor: BigInt(1),
    direction: "out",
    source: "jago",
    dedupeHash: "hash-fk",
  });

  // An account that owns a workspace cannot be deleted out from under it.
  await assert.rejects(
    h.db.delete(user).where(eq(user.id, "u-fk-owner")),
    (e: unknown) => /FOREIGN KEY constraint failed/.test(driverMessage(e)),
  );
  // A member leaving drops the attribution, never the money row.
  await h.db.delete(members).where(eq(members.userId, "u-fk-member"));
  const [row] = await h.db.select().from(transactions).where(eq(transactions.workspaceId, "ws-fk"));
  assert.equal(row.memberId, null);
});

it("rate_limits: one row per (key, window), incremented in place; the next window is a new row", async () => {
  const key = "ip:203.0.113.7";
  const hit = (windowStart: number) =>
    h.db
      .insert(rateLimits)
      .values({ key, windowStart: new Date(windowStart), count: 1, expiresAt: new Date(windowStart + 60_000) })
      .onConflictDoUpdate({
        target: [rateLimits.key, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      });

  await hit(0);
  await hit(0);
  await hit(0);
  const [first] = await h.db.select().from(rateLimits).where(eq(rateLimits.key, key));
  assert.equal(first.count, 3, "the composite PK makes the upsert the counter, no read-then-write");

  await hit(60_000);
  const rows = await h.db.select().from(rateLimits).where(eq(rateLimits.key, key));
  assert.equal(rows.length, 2, "a new window is a new row — the old one is not reset");

  // Expiry is derived, and the lazy sweep is a delete on the indexed column.
  await h.db.delete(rateLimits).where(lte(rateLimits.expiresAt, new Date(60_000)));
  const left = await h.db.select().from(rateLimits);
  assert.deepEqual(
    left.map((r) => [r.windowStart.getTime(), r.count]),
    [[60_000, 1]],
  );
});
