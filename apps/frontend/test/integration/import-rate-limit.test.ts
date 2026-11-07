import assert from "node:assert/strict";
import { register } from "node:module";
import { after, before, it, mock } from "node:test";
import { count, eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { IMPORT_LIMIT, rateLimitMessage, windowFor } from "../../src/lib/auth/rate-limit.ts";
import { imports, rateLimits, transactions, workspaces } from "../../src/lib/db/schema.ts";
import { grantEntitlement } from "../../src/lib/entitlement/grant.ts";

// Lets this test import and call the real import route with the local D1 client and a
// fixed member (see test/helpers/route-loader.mjs).
register(new URL("../helpers/route-loader.mjs", import.meta.url).href, import.meta.url);

/**
 * US-45 against the real handler (NFR-02): the 21st import in one hour is an explicit
 * 429 carrying the standard Bahasa Indonesia message and retry window, it stores
 * nothing, and another workspace's hour is untouched.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

/** Aligned to a minute and an hour, so the frozen clock sits mid-window. */
const NOW = 1_800_000_000_000;

const PAYLOAD = {
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

async function makeWorkspace(id: string, ownerId: string) {
  await addUser(h.binding, ownerId);
  await h.db.insert(workspaces).values({ id, ownerId, name: id, inviteCode: `INV-${id}` });
}

async function snapshot(workspaceId: string) {
  const [imported] = await h.db
    .select({ n: count() })
    .from(imports)
    .where(eq(imports.workspaceId, workspaceId));
  const [stored] = await h.db
    .select({ n: count() })
    .from(transactions)
    .where(eq(transactions.workspaceId, workspaceId));
  return { imports: imported.n, rows: stored.n };
}

it("the 21st import in an hour answers 429 with the retry message and stores nothing (US-45)", async () => {
  await makeWorkspace("ws-rl-a", "u-rl-a");
  await makeWorkspace("ws-rl-b", "u-rl-b");
  // A paid workspace, so the free-tier gate never masks the rate limit under test.
  await grantEntitlement(h.db, { workspaceId: "ws-rl-a", orderId: "order-rl-a" });

  const globals = globalThis as typeof globalThis & {
    __routeDb?: unknown;
    __routeUserId?: string;
  };
  globals.__routeDb = h.db;
  globals.__routeUserId = "u-rl-a";

  const { POST } = await import("../../src/app/api/workspaces/[id]/imports/route.ts");

  const postImport = (id: string) =>
    POST(
      new Request(`https://sahfund.test/api/workspaces/${id}/imports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(PAYLOAD),
      }),
      { params: Promise.resolve({ id }) },
    );

  // One frozen instant: every attempt falls in the same hourly window.
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    // Nineteen attempts already spent in this window (a D1 round trip over the test
    // proxy costs a few hundred ms, so the fixture seeds the count, not 19 calls).
    // The 20/hour rule itself is driven end to end in rate-limit.test.ts.
    const { windowStart, expiresAt } = windowFor(NOW, IMPORT_LIMIT.windowMs);
    await h.db.insert(rateLimits).values({
      key: "imp:ws-rl-a",
      windowStart: new Date(windowStart),
      count: IMPORT_LIMIT.limit - 1,
      expiresAt: new Date(expiresAt),
    });

    const twentieth = await postImport("ws-rl-a");
    assert.equal(twentieth.status, 201, "the 20th import is still inside the budget");

    const before = await snapshot("ws-rl-a");

    const denied = await postImport("ws-rl-a");
    assert.equal(denied.status, 429, "an explicit refusal, never a silent no-op");
    assert.equal(denied.headers.get("retry-after"), "3600");
    assert.deepEqual(await denied.json(), {
      message: rateLimitMessage("impor", IMPORT_LIMIT.windowMs),
    });
    assert.equal(
      rateLimitMessage("impor", IMPORT_LIMIT.windowMs),
      "Terlalu banyak impor. Tunggu satu jam lalu coba lagi.",
    );

    assert.deepEqual(await snapshot("ws-rl-a"), before, "the refused import wrote no row");
    assert.equal(before.imports, 1, "the twentieth import is the only row on disk");

    const [counter] = await h.db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, "imp:ws-rl-a"));
    assert.equal(counter.count, 20, "a denied attempt never increments the counter");

    // Another workspace has its own window: its first import still passes.
    const other = await postImport("ws-rl-b");
    assert.equal(other.status, 201);
    assert.deepEqual(await snapshot("ws-rl-b"), { imports: 1, rows: 1 });
  } finally {
    mock.timers.reset();
  }
});
