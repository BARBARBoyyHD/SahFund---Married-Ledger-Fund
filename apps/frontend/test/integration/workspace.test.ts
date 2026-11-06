import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";

import { addUser, startD1 } from "../helpers/d1.ts";
import { members, workspaces } from "../../src/lib/db/schema.ts";
import { isValidPocketCode } from "../../src/core/pocket-code.ts";
import {
  createWorkspace,
  joinWorkspace,
  rotateInviteCode,
  updateWorkspaceDetails,
} from "../../src/lib/workspace/service.ts";

/**
 * The workspace writes against real SQLite (US-05–US-08). Every refusal below comes from
 * a database constraint — the service never counts members or pre-checks a rule — so
 * these tests prove the invariant holds even when the handler is bypassed.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

const empty = { name: "Workspace", weddingDate: null, budgetTargetMinor: null } as const;

const workspaceRows = (ownerId: string) =>
  h.db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId));

const memberRows = (workspaceId: string) =>
  h.db.select().from(members).where(eq(members.workspaceId, workspaceId));

it("creates the workspace and its owner membership in one batch (US-05)", async () => {
  await addUser(h.binding, "u-create");

  const result = await createWorkspace(h.db, "u-create", {
    name: "Nikah Ayu & Budi",
    weddingDate: "2027-06-03",
    budgetTargetMinor: 5_000_000_000,
  });

  assert.equal(result.ok, true);
  assert.equal(isValidPocketCode(result.ok ? result.inviteCode : ""), true);

  const [workspace] = await h.db.select().from(workspaces).where(eq(workspaces.id, result.ok ? result.id : ""));
  assert.equal(workspace.ownerId, "u-create");
  assert.equal(workspace.name, "Nikah Ayu & Budi");
  assert.equal(workspace.weddingDate, "2027-06-03");
  // Integer minor units end to end: Rp 50.000.000 → 5_000_000_000, no float anywhere.
  assert.equal(workspace.budgetTargetMinor, BigInt(5_000_000_000));

  const rows = await memberRows(workspace.id);
  assert.deepEqual(
    rows.map((row) => [row.userId, row.role]),
    [["u-create", "owner"]],
  );
});

it("a second workspace is refused by UNIQUE(members.userId), leaving no orphan row (US-05)", async () => {
  await addUser(h.binding, "u-twice");
  assert.equal((await createWorkspace(h.db, "u-twice", empty)).ok, true);

  assert.deepEqual(await createWorkspace(h.db, "u-twice", { ...empty, name: "Kedua" }), {
    ok: false,
    reason: "already-member",
  });

  assert.equal((await workspaceRows("u-twice")).length, 1, "no second workspace row");
  assert.equal((await h.db.select().from(members).where(eq(members.userId, "u-twice"))).length, 1);
});

it("a member cannot create a workspace either, and the failed batch leaves nothing behind", async () => {
  await addUser(h.binding, "u-owner-x");
  await addUser(h.binding, "u-member-x");

  const owned = await createWorkspace(h.db, "u-owner-x", { ...empty, name: "Punya X" });
  assert.equal(owned.ok, true);
  await h.db
    .insert(members)
    .values({ workspaceId: owned.ok ? owned.id : "", userId: "u-member-x", role: "member" });

  // The workspace insert succeeds (u-member-x owns nothing), the membership insert violates
  // UNIQUE(members.userId) — so the whole batch rolls back (creation is atomic, US-05).
  assert.deepEqual(await createWorkspace(h.db, "u-member-x", { ...empty, name: "Kedua" }), {
    ok: false,
    reason: "already-member",
  });

  assert.deepEqual(await workspaceRows("u-member-x"), [], "no orphan workspace from the failed batch");
  assert.equal((await h.db.select().from(members).where(eq(members.userId, "u-member-x"))).length, 1);
});

it("joins a free member slot with the pocket code (US-06)", async () => {
  await addUser(h.binding, "u-join-owner");
  await addUser(h.binding, "u-join-guest");

  const created = await createWorkspace(h.db, "u-join-owner", empty);
  assert.equal(created.ok, true);
  const workspaceId = created.ok ? created.id : "";
  const code = created.ok ? created.inviteCode : "";

  assert.deepEqual(await joinWorkspace(h.db, "u-join-guest", code), { ok: true, workspaceId });

  const rows = await memberRows(workspaceId);
  assert.deepEqual(
    rows.map((row) => [row.userId, row.role]).sort(),
    [
      ["u-join-guest", "member"],
      ["u-join-owner", "owner"],
    ],
  );
});

it("refuses an unknown code — never an error dump (US-06)", async () => {
  await addUser(h.binding, "u-unknown-code");
  assert.deepEqual(await joinWorkspace(h.db, "u-unknown-code", "0000zzz999"), {
    ok: false,
    reason: "invalid-code",
  });
});

it("tells 'already here' from 'already elsewhere' — one read, after the refusal (US-06)", async () => {
  await addUser(h.binding, "u-here-owner");
  await addUser(h.binding, "u-here-guest");
  await addUser(h.binding, "u-elsewhere-owner");

  const mine = await createWorkspace(h.db, "u-here-owner", empty);
  const other = await createWorkspace(h.db, "u-elsewhere-owner", empty);
  assert.equal(mine.ok && other.ok, true);
  const myCode = mine.ok ? mine.inviteCode : "";
  const otherCode = other.ok ? other.inviteCode : "";

  // Join, then re-submit the same code.
  assert.equal((await joinWorkspace(h.db, "u-here-guest", myCode)).ok, true);
  assert.deepEqual(await joinWorkspace(h.db, "u-here-guest", myCode), {
    ok: false,
    reason: "already-here",
  });

  // A member elsewhere tries another workspace's code.
  assert.deepEqual(await joinWorkspace(h.db, "u-here-guest", otherCode), {
    ok: false,
    reason: "already-elsewhere",
  });

  assert.equal((await h.db.select().from(members).where(eq(members.userId, "u-here-guest"))).length, 1);
});

it("refuses a third member, and only one of two racing joins wins (US-06)", async () => {
  await addUser(h.binding, "u-full-owner");
  await addUser(h.binding, "u-full-a");
  await addUser(h.binding, "u-full-b");

  const created = await createWorkspace(h.db, "u-full-owner", empty);
  assert.equal(created.ok, true);
  const code = created.ok ? created.inviteCode : "";
  const workspaceId = created.ok ? created.id : "";

  // Two joins race for the single member slot: UNIQUE(workspaceId, role) decides.
  const race = await Promise.allSettled([
    joinWorkspace(h.db, "u-full-a", code),
    joinWorkspace(h.db, "u-full-b", code),
  ]);
  const results = race.map((settled) =>
    settled.status === "fulfilled" ? settled.value : { ok: false, reason: "unavailable" },
  );

  assert.equal(results.filter((result) => result.ok).length, 1, "exactly one joiner wins");
  assert.deepEqual(
    results.filter((result) => !result.ok).map((result) => (!result.ok ? result.reason : "")),
    ["full"],
  );
  assert.equal((await memberRows(workspaceId)).length, 2, "at most two membership rows, ever");
});

it("rotates the code: the old one stops joining, memberships are untouched (US-07)", async () => {
  await addUser(h.binding, "u-rot-owner");
  await addUser(h.binding, "u-rot-member");
  await addUser(h.binding, "u-rot-late");

  const created = await createWorkspace(h.db, "u-rot-owner", empty);
  assert.equal(created.ok, true);
  const workspaceId = created.ok ? created.id : "";
  const oldCode = created.ok ? created.inviteCode : "";
  assert.equal((await joinWorkspace(h.db, "u-rot-member", oldCode)).ok, true);
  const before = await memberRows(workspaceId);

  const rotated = await rotateInviteCode(h.db, workspaceId);
  assert.equal(rotated.ok, true);
  const newCode = rotated.ok ? rotated.inviteCode : "";

  assert.notEqual(newCode, oldCode);
  assert.equal(isValidPocketCode(newCode), true);
  assert.deepEqual(await memberRows(workspaceId), before, "membership rows unchanged");

  // The old code — and therefore every join link in an older email — is dead.
  assert.deepEqual(await joinWorkspace(h.db, "u-rot-late", oldCode), {
    ok: false,
    reason: "invalid-code",
  });
  // The new code resolves (this workspace is full, so the refusal is the cap, not the code).
  assert.deepEqual(await joinWorkspace(h.db, "u-rot-late", newCode), { ok: false, reason: "full" });
});

it("sets and changes the wedding date and budget target without touching other columns (US-08)", async () => {
  await addUser(h.binding, "u-details");
  const created = await createWorkspace(h.db, "u-details", { ...empty, name: "Tetap" });
  assert.equal(created.ok, true);
  const workspaceId = created.ok ? created.id : "";
  const inviteCode = created.ok ? created.inviteCode : "";

  // A missing date is set.
  await updateWorkspaceDetails(h.db, workspaceId, { weddingDate: "2028-01-01", budgetTargetMinor: undefined });
  let [row] = await h.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  assert.equal(row.weddingDate, "2028-01-01");
  assert.equal(row.budgetTargetMinor, null);

  // The date changes, then the budget is set — each leaves the other value and the name alone.
  await updateWorkspaceDetails(h.db, workspaceId, { weddingDate: "2028-02-02", budgetTargetMinor: undefined });
  await updateWorkspaceDetails(h.db, workspaceId, { weddingDate: undefined, budgetTargetMinor: 1_000_000_000 });

  [row] = await h.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  assert.equal(row.weddingDate, "2028-02-02");
  assert.equal(row.budgetTargetMinor, BigInt(1_000_000_000));
  assert.equal(row.name, "Tetap");
  assert.equal(row.inviteCode, inviteCode);
  assert.equal(row.ownerId, "u-details");
});
