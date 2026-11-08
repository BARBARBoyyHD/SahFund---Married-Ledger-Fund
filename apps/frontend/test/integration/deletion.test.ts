import assert from "node:assert/strict";
import { register } from "node:module";
import { after, before, it } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import {
  account,
  categories,
  commitments,
  entitlementGrants,
  imports,
  members,
  payeeRules,
  rateLimits,
  session,
  shareTokens,
  transactions,
  user,
  verification,
  workspaces,
} from "../../src/lib/db/schema.ts";
import { ACCOUNT_MESSAGE } from "../../src/lib/deletion.ts";
import { WORKSPACE_MESSAGE } from "../../src/lib/workspace/messages.ts";

// The real handlers, with the local D1 client and a test-supplied session/membership
// (see test/helpers/route-loader.mjs).
register(new URL("../helpers/route-loader.mjs", import.meta.url).href, import.meta.url);

/**
 * US-39/US-40 against real SQLite: the cascade leaves no queryable orphan in any table,
 * a non-owner is refused, and an account deletion takes the sessions with it so the next
 * authenticated call fails.
 */

let h: Awaited<ReturnType<typeof startD1>>;

const globals = globalThis as typeof globalThis & {
  __routeDb?: unknown;
  __routeUserId?: string;
  __routeRole?: string;
  __routeSession?: () => Promise<{ user: { id: string; email: string } } | null>;
};

before(async () => {
  h = await startD1();
  globals.__routeDb = h.db;
});

after(async () => {
  await h.dispose();
});

/** A workspace with one row in every table the cascade must reach. */
async function seedWorkspace(id: string, ownerId: string, memberId?: string) {
  await addUser(h.binding, ownerId);
  if (memberId) await addUser(h.binding, memberId);

  const importId = `imp-${id}`;
  const categoryId = `cat-${id}`;

  await h.db.insert(workspaces).values({ id, ownerId, name: id, inviteCode: `INV-${id}` });
  await h.db.batch([
    h.db.insert(members).values({ workspaceId: id, userId: ownerId, role: "owner" }),
    ...(memberId
      ? [h.db.insert(members).values({ workspaceId: id, userId: memberId, role: "member" })]
      : []),
    h.db.insert(categories).values({ id: categoryId, workspaceId: id, name: "Katering", kind: "expense", sort: 0 }),
    h.db.insert(imports).values({
      id: importId,
      workspaceId: id,
      sourceId: "jago",
      pocketName: "Dompet",
      txCount: 1,
      reconciled: true,
      issues: [],
    }),
    h.db.insert(transactions).values({
      id: `tx-${id}`,
      workspaceId: id,
      importId,
      categoryId,
      memberId: ownerId,
      occurredOn: "2026-11-01",
      description: "Katering",
      amountMinor: BigInt(-250_000),
      balanceMinor: BigInt(750_000),
      direction: "out",
      source: "jago",
      dedupeHash: `hash-${id}`,
    }),
    h.db.insert(commitments).values({
      workspaceId: id,
      vendor: "Gedung",
      categoryId,
      totalMinor: BigInt(10_000_000),
      paidMinor: BigInt(2_000_000),
      status: "unpaid",
    }),
    h.db.insert(payeeRules).values({ workspaceId: id, payee: "Katering Ayu", categoryId }),
    h.db.insert(entitlementGrants).values({ workspaceId: id, orderId: `order-${id}` }),
    h.db.insert(shareTokens).values({ workspaceId: id, token: `token-${id}`, expiresAt: new Date() }),
    // The workspace-keyed counters the limiter writes: invite `ws:<id>`, import `imp:<id>`.
    h.db.insert(rateLimits).values([
      { key: `ws:${id}`, windowStart: new Date(0), count: 1, expiresAt: new Date(0) },
      { key: `imp:${id}`, windowStart: new Date(0), count: 1, expiresAt: new Date(0) },
    ]),
  ]);
}

/** Every table scoped by workspaceId, counted — the "no queryable orphan" assertion. */
async function workspaceRowCounts(id: string) {
  const countOf = async (rows: Promise<unknown[]>) => (await rows).length;

  return {
    transactions: await countOf(h.db.select().from(transactions).where(eq(transactions.workspaceId, id))),
    imports: await countOf(h.db.select().from(imports).where(eq(imports.workspaceId, id))),
    commitments: await countOf(h.db.select().from(commitments).where(eq(commitments.workspaceId, id))),
    categories: await countOf(h.db.select().from(categories).where(eq(categories.workspaceId, id))),
    members: await countOf(h.db.select().from(members).where(eq(members.workspaceId, id))),
    entitlementGrants: await countOf(
      h.db.select().from(entitlementGrants).where(eq(entitlementGrants.workspaceId, id)),
    ),
    shareTokens: await countOf(h.db.select().from(shareTokens).where(eq(shareTokens.workspaceId, id))),
    payeeRules: await countOf(h.db.select().from(payeeRules).where(eq(payeeRules.workspaceId, id))),
    rateLimits: await countOf(
      h.db.select().from(rateLimits).where(inArray(rateLimits.key, [`ws:${id}`, `imp:${id}`])),
    ),
    workspaces: await countOf(h.db.select().from(workspaces).where(eq(workspaces.id, id))),
  };
}

async function deleteWorkspaceRoute(id: string) {
  const { DELETE } = await import("../../src/app/api/workspaces/[id]/route.ts");
  return DELETE(
    new Request(`https://sahfund.test/api/workspaces/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
}

/** Reads the token's session row — exactly the lookup Better Auth does per request. */
function sessionReader(token: string) {
  return async () => {
    const [row] = await h.db
      .select({ userId: session.userId })
      .from(session)
      .where(eq(session.token, token))
      .limit(1);
    return row ? { user: { id: row.userId, email: `${row.userId}@test.local` } } : null;
  };
}

async function deleteAccountRoute(body: unknown) {
  const { DELETE } = await import("../../src/app/api/account/route.ts");
  return DELETE(
    new Request("https://sahfund.test/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function accountStateRoute() {
  const { GET } = await import("../../src/app/api/account/route.ts");
  return GET();
}

it("the owner's delete removes every dependent row in one batch (US-39)", async () => {
  await seedWorkspace("ws-del-a", "u-del-a", "u-del-a2");
  await seedWorkspace("ws-del-b", "u-del-b");

  globals.__routeUserId = "u-del-a";
  globals.__routeRole = "owner";

  const response = await deleteWorkspaceRoute("ws-del-a");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  assert.deepEqual(await workspaceRowCounts("ws-del-a"), {
    transactions: 0,
    imports: 0,
    commitments: 0,
    categories: 0,
    members: 0,
    entitlementGrants: 0,
    shareTokens: 0,
    payeeRules: 0,
    rateLimits: 0,
    workspaces: 0,
  });

  // Scoped, not a table wipe: the neighbouring workspace keeps its rows.
  assert.equal((await workspaceRowCounts("ws-del-b")).transactions, 1);
  assert.equal((await workspaceRowCounts("ws-del-b")).workspaces, 1);
});

it("a member cannot delete the workspace (US-39)", async () => {
  await seedWorkspace("ws-del-c", "u-del-c", "u-del-c2");

  globals.__routeUserId = "u-del-c2";
  globals.__routeRole = "member";

  const response = await deleteWorkspaceRoute("ws-del-c");
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: WORKSPACE_MESSAGE.ownerOnly });

  const counts = await workspaceRowCounts("ws-del-c");
  assert.equal(counts.workspaces, 1, "the workspace is untouched");
  assert.equal(counts.transactions, 1);
  assert.equal(counts.members, 2);
});

it("account delete refuses to guess while a second member shares the workspace (US-40)", async () => {
  await seedWorkspace("ws-acc-a", "u-acc-a", "u-acc-a2");
  await h.db.insert(session).values({
    id: "ses-acc-a",
    token: "tok-acc-a",
    userId: "u-acc-a",
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  globals.__routeSession = sessionReader("tok-acc-a");

  const state = await accountStateRoute();
  assert.equal(state.status, 200);
  assert.deepEqual(await state.json(), {
    ownedWorkspace: {
      id: "ws-acc-a",
      name: "ws-acc-a",
      memberCount: 2,
      requiresExplicitPath: true,
    },
  });

  const refused = await deleteAccountRoute({ confirm: "hapus-akun" });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).message, ACCOUNT_MESSAGE.workspacePathRequired);
  assert.equal((await workspaceRowCounts("ws-acc-a")).transactions, 1, "nothing was deleted");

  const unconfirmed = await deleteAccountRoute({});
  assert.equal(unconfirmed.status, 422, "the confirm field is required");

  const accepted = await deleteAccountRoute({ confirm: "hapus-akun", workspacePath: "delete-with-it" });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await workspaceRowCounts("ws-acc-a"), {
    transactions: 0,
    imports: 0,
    commitments: 0,
    categories: 0,
    members: 0,
    entitlementGrants: 0,
    shareTokens: 0,
    payeeRules: 0,
    rateLimits: 0,
    workspaces: 0,
  });
});

it("a sole-member account delete removes the user and its sessions (US-40)", async () => {
  await seedWorkspace("ws-acc-b", "u-acc-b");
  await h.db.batch([
    h.db.insert(session).values({
      id: "ses-acc-b",
      token: "tok-acc-b",
      userId: "u-acc-b",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    // The sign-in credential Better Auth checks — gone means sign-in cannot match a user.
    h.db.insert(account).values({
      id: "acct-acc-b",
      accountId: "u-acc-b",
      providerId: "credential",
      userId: "u-acc-b",
      password: "not-a-real-hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    h.db.insert(verification).values({
      id: "ver-acc-b",
      identifier: "u-acc-b@test.local",
      value: "token",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ]);
  globals.__routeSession = sessionReader("tok-acc-b");

  const state = await accountStateRoute();
  assert.equal(state.status, 200);
  assert.equal((await state.json()).ownedWorkspace.requiresExplicitPath, false, "sole member: no choice needed");

  const response = await deleteAccountRoute({ confirm: "hapus-akun" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: ACCOUNT_MESSAGE.deleted,
    redirectTo: "/login",
  });

  assert.equal((await workspaceRowCounts("ws-acc-b")).workspaces, 0);
  assert.equal((await h.db.select().from(user).where(eq(user.id, "u-acc-b"))).length, 0);
  assert.equal((await h.db.select().from(account).where(eq(account.userId, "u-acc-b"))).length, 0);
  assert.equal((await h.db.select().from(session).where(eq(session.userId, "u-acc-b"))).length, 0);
  assert.equal(
    (await h.db.select().from(verification).where(eq(verification.identifier, "u-acc-b@test.local"))).length,
    0,
  );

  // The session row is gone, so the next authenticated call is refused — the same lookup
  // Better Auth performs, and why sign-in can no longer succeed (no user, no credential).
  const after = await accountStateRoute();
  assert.equal(after.status, 401);
});
