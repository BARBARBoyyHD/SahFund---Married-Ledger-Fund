import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { categories, members, transactions } from "../../src/lib/db/schema.ts";
import { classifyError } from "../../src/lib/db/index.ts";
import { CATEGORY_MESSAGE } from "../../src/lib/categories/messages.ts";
import { updateCategory } from "../../src/lib/categories/update-category.ts";
import { bulkAttributeSchema, bulkAttributeTransactions } from "../../src/lib/ledger/bulk-attribute.ts";
import { createManualTransactionSchema } from "../../src/lib/ledger/schema.ts";
import { createManualTransaction } from "../../src/lib/ledger/service.ts";
import { createShareToken, revokeShareToken } from "../../src/lib/share/manage.ts";
import { resolveShareToken } from "../../src/lib/share/resolve-token.ts";
import { shareTokenExpiry } from "../../src/lib/share/token.ts";
import { SEED_CATEGORY_NAMES } from "../../src/lib/workspace/wedding-category-seed.ts";
import { createWorkspace } from "../../src/lib/workspace/workspace-mutations.ts";

/**
 * The reporting round against real SQLite (US-21/US-22/US-24/US-34): the unique index
 * refuses a duplicate manual row, a bulk action reports every selected id exactly once,
 * a workspace is born with its ten seeded categories and no second "Catering", and a
 * share link dies at its deadline or the moment it is revoked.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

/** A workspace through the real create path (also seeds the ten categories). */
async function workspaceFor(ownerId: string) {
  await addUser(h.binding, ownerId);
  const created = await createWorkspace(h.db, ownerId, {
    name: ownerId,
    weddingDate: null,
    budgetTargetMinor: null,
  });
  if (!created.ok) assert.fail(`create failed: ${created.reason}`);
  return { id: created.id, code: created.inviteCode };
}

const txRows = (workspaceId: string) =>
  h.db.select().from(transactions).where(eq(transactions.workspaceId, workspaceId));

/** The direct-insert shape for a ledger row, unique per id through its hash. */
const txRow = (workspaceId: string, id: string, memberId: string | null = null) => ({
  id,
  workspaceId,
  memberId,
  occurredOn: "2026-11-06",
  description: `baris ${id}`,
  amountMinor: BigInt(-1_000),
  balanceMinor: BigInt(0),
  direction: "out",
  source: "jago",
  dedupeHash: `hash-${id}`,
});

// --- US-21: manual-entry dedupe conflict -------------------------------------------

it("refuses a second manual row with the same date + amount, leaving one row (US-21)", async () => {
  const { id } = await workspaceFor("u-manual");

  // Parsed through the one shared schema, exactly as the route handler does.
  const row = createManualTransactionSchema.parse({
    occurredOn: "2026-11-06",
    description: "DP dekorasi tunai",
    direction: "out",
    amount: "250.000",
    categoryId: "",
    memberId: "",
  });

  const first = await createManualTransaction(h.db, id, row);
  assert.equal(first.ok, true);

  const [stored] = await txRows(id);
  assert.equal(stored.source, "manual");
  assert.equal(stored.importId, null);
  assert.equal(stored.amountMinor, BigInt(-25_000_000), "integer minor units, no float");

  // The unique index on (workspaceId, dedupeHash) is the enforcement — the service only
  // names it "conflict" (route maps that to 409, never a raw driver message).
  assert.deepEqual(await createManualTransaction(h.db, id, row), { ok: false, reason: "conflict" });
  assert.equal((await txRows(id)).length, 1, "the refused duplicate wrote nothing");

  // The pinned tuple is date + amount (service.ts:88): a different description still collides.
  assert.deepEqual(
    await createManualTransaction(h.db, id, { ...row, description: "Nominal sama, cerita lain" }),
    { ok: false, reason: "conflict" },
  );
  assert.equal((await txRows(id)).length, 1);

  // Another workspace has its own dedupe namespace — the same row is fine there.
  const other = await workspaceFor("u-manual-other");
  assert.equal((await createManualTransaction(h.db, other.id, row)).ok, true);
});

// --- US-24: bulk-attribute partial reporting ---------------------------------------

it("reports updated vs notFound per id, and never touches a foreign row (US-24)", async () => {
  const workspaceId = await workspaceFor("u-bulk-owner");
  await addUser(h.binding, "u-bulk-member");
  await h.db.insert(members).values({ workspaceId: workspaceId.id, userId: "u-bulk-member", role: "member" });
  const otherWorkspace = await workspaceFor("u-bulk-other");

  await h.db.batch([
    h.db.insert(transactions).values(txRow(workspaceId.id, "tx-a1")),
    h.db.insert(transactions).values(txRow(workspaceId.id, "tx-a2")),
    h.db.insert(transactions).values(txRow(workspaceId.id, "tx-a3")),
    h.db.insert(transactions).values(txRow(otherWorkspace.id, "tx-b1")),
  ]);

  // The route parses the body with this schema first; the repeated id is one outcome.
  const data = bulkAttributeSchema.parse({
    ids: ["tx-a1", "tx-a1", "tx-a2", "tx-missing", "tx-b1"],
    memberId: "u-bulk-member",
  });

  assert.deepEqual(await bulkAttributeTransactions(h.db, workspaceId.id, data), {
    ok: true,
    updated: ["tx-a1", "tx-a2"],
    notFound: ["tx-missing", "tx-b1"],
  });

  const byId = new Map((await txRows(workspaceId.id)).map((row) => [row.id, row]));
  assert.equal(byId.get("tx-a1")?.memberId, "u-bulk-member");
  assert.equal(byId.get("tx-a2")?.memberId, "u-bulk-member");
  assert.equal(byId.get("tx-a3")?.memberId, null, "unselected rows are untouched");

  const [foreign] = await txRows(otherWorkspace.id);
  assert.equal(foreign.memberId, null, "a foreign id is reported, never updated");
});

it("refuses a member from another workspace before writing anything (US-24)", async () => {
  const workspaceId = await workspaceFor("u-bulk-x");
  // This user is a real member — just not of this workspace.
  await workspaceFor("u-bulk-x-other");
  await h.db.insert(transactions).values(txRow(workspaceId.id, "tx-x1"));

  const result = await bulkAttributeTransactions(
    h.db,
    workspaceId.id,
    bulkAttributeSchema.parse({ ids: ["tx-x1"], memberId: "u-bulk-x-other" }),
  );

  assert.deepEqual(result, { ok: false, reason: "unknown-reference" });
  const [row] = await txRows(workspaceId.id);
  assert.equal(row.memberId, null, "no row was labelled with the other couple's member");
});

// --- US-22: category seed uniqueness -----------------------------------------------

it("creates the ten seeded categories once, and a duplicate name is refused (US-22)", async () => {
  const { id } = await workspaceFor("u-cat");

  const seeded = await h.db.select().from(categories).where(eq(categories.workspaceId, id));
  assert.equal(seeded.length, SEED_CATEGORY_NAMES.length);
  assert.deepEqual(seeded.map((row) => row.name).sort(), [...SEED_CATEGORY_NAMES].sort());
  assert.deepEqual(
    seeded.map((row) => row.sort).sort((a, b) => a - b),
    Array.from({ length: SEED_CATEGORY_NAMES.length }, (_, index) => index + 1),
  );

  // The rename path classifies UNIQUE(workspaceId, name) as "duplicate-name" (P3) —
  // the handler renders CATEGORY_MESSAGE.duplicateName, never the driver text.
  const venue = seeded.find((row) => row.name === "Venue");
  assert.ok(venue);
  assert.deepEqual(await updateCategory(h.db, id, venue.id, { name: "Catering", budgetMinor: undefined }), {
    ok: false,
    reason: "duplicate-name",
  });
  assert.match(CATEGORY_MESSAGE.duplicateName, /sudah dipakai/);

  // A direct insert is refused by the same index, and the classifier names it exactly.
  const error = await h.db
    .insert(categories)
    .values({ workspaceId: id, name: "Catering", kind: "expense", sort: 11 })
    .then(
      () => assert.fail("UNIQUE(workspaceId, name) should have fired"),
      (e: unknown) => e,
    );
  assert.deepEqual(classifyError(error), { kind: "unique", table: "categories", columns: ["workspaceId", "name"] });

  const after = await h.db.select().from(categories).where(eq(categories.workspaceId, id));
  assert.equal(after.length, SEED_CATEGORY_NAMES.length, "no duplicate row stored");
  assert.equal(after.find((row) => row.id === venue.id)?.name, "Venue", "the refused rename changed nothing");
});

// --- US-33/US-34: share token resolve/revoke ---------------------------------------

it("resolves an active token and refuses it at the deadline or when unknown (US-33)", async () => {
  const { id } = await workspaceFor("u-share");
  const now = new Date("2026-11-08T00:00:00.000Z");
  const created = await createShareToken(h.db, id, now);

  assert.equal(await resolveShareToken(h.db, created.token, now), id);

  // Boundary: `expiresAt <= now` is expired (shareTokenState), so the last active
  // millisecond resolves and the deadline itself does not.
  const deadline = shareTokenExpiry(now);
  assert.equal(deadline.getTime(), created.expiresAt.getTime());
  assert.equal(await resolveShareToken(h.db, created.token, new Date(deadline.getTime() - 1)), id);
  assert.equal(await resolveShareToken(h.db, created.token, deadline), null);

  assert.equal(await resolveShareToken(h.db, "f".repeat(32), now), null, "unknown token");
  assert.equal(await resolveShareToken(h.db, "", now), null, "empty token short-circuits");
});

it("revocation takes effect immediately and is workspace-scoped (US-34)", async () => {
  const { id } = await workspaceFor("u-revoke");
  const other = await workspaceFor("u-revoke-other");
  const now = new Date("2026-11-08T00:00:00.000Z");
  const created = await createShareToken(h.db, id, now);

  // The owner of another workspace cannot revoke this link, and the link still works.
  assert.equal(await revokeShareToken(h.db, other.id, created.id, now), false);
  assert.equal(await resolveShareToken(h.db, created.token, now), id);

  // The owner's revoke is a flag, not a delete: the row is still listed for the owner,
  // but every resolve checks it, so the next request — even within the TTL — is gone.
  assert.equal(await revokeShareToken(h.db, id, created.id, now), true);
  assert.equal(await resolveShareToken(h.db, created.token, now), null);
  assert.equal(await resolveShareToken(h.db, created.token, new Date(now.getTime() + 1_000)), null);
});
