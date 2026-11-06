import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { rateLimits } from "../../src/lib/db/schema.ts";
import { createWorkspace, joinWorkspace, sendInvite } from "../../src/lib/workspace/service.ts";

/**
 * The invite path against real SQLite (US-52): the NFR-02 budget is spent before the
 * email leaves, every send failure answers `fallback` with a still-valid code, and no log
 * line carries the code or the recipient (ITA §11.9).
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

const ORIGIN = "https://sahfund.test";
const MAIL = { apiKey: "re_test", from: "SahFund <invite@sahfund.test>" };
const accepted = (async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 })) as unknown as typeof fetch;

/** A fresh workspace with one owner; returns its id and code. */
async function workspaceFor(ownerId: string) {
  await addUser(h.binding, ownerId);
  const created = await createWorkspace(h.db, ownerId, {
    name: "Undangan",
    weddingDate: null,
    budgetTargetMinor: null,
  });
  if (!created.ok) assert.fail(`create failed: ${created.reason}`);
  return { id: created.id, code: created.inviteCode };
}

const counter = async (workspaceId: string) => {
  const [row] = await h.db.select().from(rateLimits).where(eq(rateLimits.key, `ws:${workspaceId}`));
  return row?.count ?? 0;
};

it("allows ten sends an hour and refuses the eleventh without incrementing (US-52)", async () => {
  const workspace = await workspaceFor("u-inv-owner");

  for (let i = 0; i < 10; i++) {
    const result = await sendInvite(h.db, workspace.id, "partner@example.com", {
      origin: ORIGIN,
      mail: MAIL,
      fetchImpl: accepted,
    });
    assert.equal(result.status, "sent", `send ${i + 1}`);
  }

  assert.deepEqual(
    await sendInvite(h.db, workspace.id, "partner@example.com", {
      origin: ORIGIN,
      mail: MAIL,
      fetchImpl: accepted,
    }),
    { status: "rate-limited" },
  );

  assert.equal(await counter(workspace.id), 10, "the refused send writes nothing");
});

it("tracks each workspace's hourly budget independently (NFR-02)", async () => {
  const first = await workspaceFor("u-inv-a");
  const second = await workspaceFor("u-inv-b");

  for (let i = 0; i < 10; i++) {
    await sendInvite(h.db, first.id, "partner@example.com", { origin: ORIGIN, mail: MAIL, fetchImpl: accepted });
  }
  assert.equal((await sendInvite(h.db, first.id, "partner@example.com", { origin: ORIGIN, mail: MAIL, fetchImpl: accepted })).status, "rate-limited");

  const other = await sendInvite(h.db, second.id, "partner@example.com", {
    origin: ORIGIN,
    mail: MAIL,
    fetchImpl: accepted,
  });
  assert.equal(other.status, "sent", "the second workspace has its own window");
});

it("without a RESEND_API_KEY it falls back with a code that still joins (US-52)", async () => {
  const workspace = await workspaceFor("u-inv-nokey");

  const result = await sendInvite(h.db, workspace.id, "partner@example.com", {
    origin: ORIGIN,
    mail: {},
    fetchImpl: accepted,
  });
  if (result.status !== "fallback") assert.fail(`expected fallback, got ${result.status}`);

  assert.equal(result.code, workspace.code);
  assert.equal(result.joinUrl, `${ORIGIN}/join?code=${workspace.code}`);

  // The invite is unaffected: the code in the panel is the credential.
  await addUser(h.binding, "u-inv-nokey-guest");
  assert.equal((await joinWorkspace(h.db, "u-inv-nokey-guest", result.code)).ok, true);
});

it("a Resend rejection falls back, still counts the attempt, and logs no code or email (US-52)", async () => {
  const workspace = await workspaceFor("u-inv-rejected");
  const rejected = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;

  const logs: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => logs.push(args.map((arg) => JSON.stringify(arg)).join(" "));

  let result;
  try {
    result = await sendInvite(h.db, workspace.id, "partner@example.com", {
      origin: ORIGIN,
      mail: MAIL,
      fetchImpl: rejected,
    });
  } finally {
    console.warn = original;
  }

  if (result.status !== "fallback") assert.fail(`expected fallback, got ${result.status}`);
  assert.equal(result.code, workspace.code);
  assert.equal(await counter(workspace.id), 1, "a failed send is still a spent attempt");

  assert.ok(logs.length > 0, "the failure is logged, never swallowed");
  assert.doesNotMatch(logs.join("\n"), new RegExp(workspace.code), "the pocket code never reaches a log");
  assert.doesNotMatch(logs.join("\n"), /partner@example\.com/, "the recipient never reaches a log");
});

it("a network failure is a fallback too, never a thrown error", async () => {
  const workspace = await workspaceFor("u-inv-network");
  const offline = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;

  const result = await sendInvite(h.db, workspace.id, "partner@example.com", {
    origin: ORIGIN,
    mail: MAIL,
    fetchImpl: offline,
  });

  assert.equal(result.status, "fallback");
  assert.equal(await counter(workspace.id), 1);
});
