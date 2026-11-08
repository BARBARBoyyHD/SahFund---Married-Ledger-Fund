import assert from "node:assert/strict";
import { register } from "node:module";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { entitlementGrants, imports, transactions, workspaces } from "../../src/lib/db/schema.ts";
import { exportGate, importGate } from "../../src/lib/entitlement/gate.ts";
import { ENTITLEMENT_MESSAGE } from "../../src/lib/entitlement/messages.ts";

// The switch is off by default (B-3): make that explicit rather than inherit an env
// var from the shell running the suite.
delete process.env.PAYMENT_ENABLED;

register(new URL("../helpers/route-loader.mjs", import.meta.url).href, import.meta.url);

// `connection()` is a Next rendering hint that throws outside a request scope, so the
// export route can only be called from `node:test` with it stubbed. Everything else in
// `next/server` is the real module.
const NEXT_SERVER_STUB = `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier !== "next/server") return nextResolve(specifier, context);
  const real = await nextResolve("next/server.js", context);
  const body =
    "export * from " + JSON.stringify(real.url) + ";\\nexport async function connection() {}";
  return { url: "data:text/javascript," + encodeURIComponent(body), shortCircuit: true };
}
`)}`;
register(NEXT_SERVER_STUB, import.meta.url);

/**
 * Payment disabled (B-3, docs/projects/NOTE-payment-disabled.md): every workspace
 * imports without limit and exports without a grant, and there is nothing to buy.
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

/** The normalised payload the browser posts — one reconciled outgoing row (US-12). */
const IMPORT_PAYLOAD = {
  sourceId: "jago",
  pocketName: "Dompet",
  period: null,
  openingBalanceMinor: 1_000_000,
  totalInMinor: 0,
  totalOutMinor: 250_000,
  closingBalanceMinor: 750_000,
  transactions: [
    {
      date: "2026-11-01",
      time: "",
      description: "Katering",
      amountMinor: -250_000,
      balanceMinor: 750_000,
      direction: "out",
      ref: "",
    },
  ],
};

it("both gates pass without a grant, even after an import (US-35/US-38 off)", async () => {
  await makeWorkspace("ws-off", "u-off");
  await h.db.insert(imports).values({
    workspaceId: "ws-off",
    sourceId: "jago",
    pocketName: "Dompet",
    txCount: 1,
    reconciled: true,
    issues: [],
  });

  assert.deepEqual(await importGate(h.db, "ws-off"), { ok: true });
  assert.deepEqual(await exportGate(h.db, "ws-off"), { ok: true });
});

it("a second import answers 201 and export answers 200 — free, no grant (B-3)", async () => {
  await makeWorkspace("ws-off-http", "u-off-http");

  const globals = globalThis as typeof globalThis & {
    __routeDb?: unknown;
    __routeUserId?: string;
  };
  globals.__routeDb = h.db;
  globals.__routeUserId = "u-off-http";

  const { POST: postImport } = await import("../../src/app/api/workspaces/[id]/imports/route.ts");
  const { GET: getExport } = await import("../../src/app/api/workspaces/[id]/export/route.ts");

  const request = () =>
    postImport(
      new Request("https://sahfund.test/api/workspaces/ws-off-http/imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(IMPORT_PAYLOAD),
      }),
      { params: Promise.resolve({ id: "ws-off-http" }) },
    );

  assert.equal((await request()).status, 201, "the first import is free");
  assert.equal((await request()).status, 201, "the second import is free too while payment is off");

  const importRows = await h.db
    .select({ id: imports.id })
    .from(imports)
    .where(eq(imports.workspaceId, "ws-off-http"));
  assert.equal(importRows.length, 2, "both imports were stored");

  const exported = await getExport(
    new Request("https://sahfund.test/api/workspaces/ws-off-http/export"),
    { params: Promise.resolve({ id: "ws-off-http" }) },
  );
  assert.equal(exported.status, 200, "export no longer needs a grant");
  assert.match(await exported.text(), /^occurredOn,description,amountMinor/);
});

it("the grant endpoint answers 503 and writes nothing while payment is off (US-37 off)", async () => {
  await makeWorkspace("ws-off-grant", "u-off-grant");

  const globals = globalThis as typeof globalThis & {
    __routeDb?: unknown;
    __routeUserId?: string;
  };
  globals.__routeDb = h.db;
  globals.__routeUserId = "u-off-grant";

  const { POST } = await import("../../src/app/api/entitlements/route.ts");

  const response = await POST(
    new Request("https://sahfund.test/api/entitlements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws-off-grant", orderId: "order-off" }),
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: ENTITLEMENT_MESSAGE.paymentDisabled });

  const grants = await h.db.select().from(entitlementGrants);
  assert.equal(grants.length, 0, "a refused purchase grants nothing");
  const rows = await h.db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.workspaceId, "ws-off-grant"));
  assert.equal(rows.length, 0);
});
