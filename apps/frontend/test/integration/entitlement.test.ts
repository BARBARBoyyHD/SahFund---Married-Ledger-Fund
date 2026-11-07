import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { entitlementGrants, imports, transactions, workspaces } from "../../src/lib/db/schema.ts";
import { grantEntitlement } from "../../src/lib/entitlement/grant.ts";
import { exportGate, importGate } from "../../src/lib/entitlement/gate.ts";
import { ENTITLEMENT_MESSAGE } from "../../src/lib/entitlement/messages.ts";
import { EXPORT_HEADER, readExportRows, transactionsToCsv } from "../../src/lib/ledger/export.ts";

/**
 * Entitlement against real SQLite (US-35, US-37, US-38): the grant is idempotent per
 * order on the unique index, the free tier ends after one import, and the export is
 * one workspace-scoped read.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

async function makeWorkspace(id: string, ownerId: string) {
  await addUser(h.binding, ownerId);
  await h.db.insert(workspaces).values({ id, ownerId, name: id, inviteCode: `INV-${id}` });
}

it("grants once per order id — a duplicate is a no-op (US-37)", async () => {
  await makeWorkspace("ws-grant", "u-grant");

  assert.deepEqual(await grantEntitlement(h.db, { workspaceId: "ws-grant", orderId: "order-1" }), {
    ok: true,
    alreadyGranted: false,
  });
  assert.deepEqual(await grantEntitlement(h.db, { workspaceId: "ws-grant", orderId: "order-1" }), {
    ok: true,
    alreadyGranted: true,
  });

  const rows = await h.db
    .select()
    .from(entitlementGrants)
    .where(eq(entitlementGrants.orderId, "order-1"));
  assert.equal(rows.length, 1, "a retried grant never writes a second row");
  assert.equal(rows[0].workspaceId, "ws-grant");
});

it("the first import is free; a second one is locked with the unlock message (US-35)", async () => {
  await makeWorkspace("ws-free", "u-free");

  assert.deepEqual(await importGate(h.db, "ws-free"), { ok: true }, "no prior import → free");

  await h.db.insert(imports).values({
    workspaceId: "ws-free",
    sourceId: "jago",
    pocketName: "Dompet",
    txCount: 1,
    reconciled: true,
    issues: [],
  });

  assert.deepEqual(await importGate(h.db, "ws-free"), {
    ok: false,
    message: ENTITLEMENT_MESSAGE.locked,
  });
  assert.match(ENTITLEMENT_MESSAGE.locked, /Sekali bayar Rp 49\.000/);
  assert.match(ENTITLEMENT_MESSAGE.locked, /impor tanpa batas dan ekspor/);
});

it("a paid workspace imports without the free limit and may export (US-37/US-38)", async () => {
  await makeWorkspace("ws-paid", "u-paid");

  assert.deepEqual(await exportGate(h.db, "ws-paid"), {
    ok: false,
    message: ENTITLEMENT_MESSAGE.locked,
  });

  await h.db.insert(imports).values({
    workspaceId: "ws-paid",
    sourceId: "jago",
    pocketName: "Dompet",
    txCount: 1,
    reconciled: true,
    issues: [],
  });

  await grantEntitlement(h.db, { workspaceId: "ws-paid", orderId: "order-paid" });

  assert.deepEqual(await importGate(h.db, "ws-paid"), { ok: true });
  assert.deepEqual(await exportGate(h.db, "ws-paid"), { ok: true });
});

it("a paid export contains only that workspace's rows, in machine-readable form (US-38)", async () => {
  await makeWorkspace("ws-exp-a", "u-exp-a");
  await makeWorkspace("ws-exp-b", "u-exp-b");

  await h.db.batch([
    h.db.insert(transactions).values({
      id: "tx-a-1",
      workspaceId: "ws-exp-a",
      occurredOn: "2026-11-01",
      description: 'Katering "Ayu", gedung',
      amountMinor: BigInt(-2_500_000),
      balanceMinor: BigInt(7_500_000),
      direction: "out",
      source: "jago",
      dedupeHash: "hash-a-1",
      ref: "REF-1",
    }),
    h.db.insert(transactions).values({
      id: "tx-a-2",
      workspaceId: "ws-exp-a",
      occurredOn: "2026-11-02",
      description: "Transfer masukan",
      amountMinor: BigInt(1_000_000),
      balanceMinor: BigInt(8_500_000),
      direction: "in",
      source: "jago",
      dedupeHash: "hash-a-2",
    }),
    h.db.insert(transactions).values({
      id: "tx-b-1",
      workspaceId: "ws-exp-b",
      occurredOn: "2026-11-03",
      description: "Milik B",
      amountMinor: BigInt(-500_000),
      balanceMinor: BigInt(500_000),
      direction: "out",
      source: "jago",
      dedupeHash: "hash-b-1",
    }),
  ]);

  const rows = await readExportRows(h.db, "ws-exp-a");
  assert.deepEqual(
    rows.map((row) => row.description),
    ["Katering \"Ayu\", gedung", "Transfer masukan"],
    "only workspace A's rows, in date order",
  );

  const csv = transactionsToCsv(rows);
  const lines = csv.trimEnd().split("\n");
  assert.equal(lines[0], EXPORT_HEADER);
  assert.equal(lines.length, 3, "header + two rows, no header row from another workspace");
  assert.match(csv, /2026-11-01,"Katering ""Ayu"", gedung",-2500000,7500000,out,REF-1/);
  assert.match(csv, /2026-11-02,Transfer masukan,1000000,8500000,in,/);
  assert.doesNotMatch(csv, /Milik B/, "another workspace's row never reaches the file");
});
