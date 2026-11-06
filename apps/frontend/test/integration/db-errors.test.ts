import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import { startD1, addUser } from "../helpers/d1.ts";
import { members, workspaces } from "../../src/lib/db/schema.ts";
import { classifyError } from "../../src/lib/db/index.ts";

/**
 * The P3 classifier against the real driver (design D5). The unit test pins the
 * parser; this pins the message D1 + Drizzle actually produce, so a driver upgrade
 * that changes the text fails here rather than in a handler's message mapping.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

it("classifies a real unique violation on a single column", async () => {
  await addUser(h.binding, "u-err-1");
  await addUser(h.binding, "u-err-2");
  await h.db.insert(workspaces).values({ ownerId: "u-err-1", name: "A", inviteCode: "INV-ERR" });

  const error = await h.db
    .insert(workspaces)
    .values({ ownerId: "u-err-2", name: "B", inviteCode: "INV-ERR" })
    .then(
      () => assert.fail("expected a unique violation"),
      (e: unknown) => e,
    );

  assert.deepEqual(classifyError(error), {
    kind: "unique",
    table: "workspaces",
    columns: ["inviteCode"],
  });
});

it("classifies a real composite unique index — the full-workspace refusal (FR-02)", async () => {
  await addUser(h.binding, "u-err-owner");
  await addUser(h.binding, "u-err-third");
  await h.db.insert(workspaces).values({ id: "ws-err", ownerId: "u-err-owner", name: "E", inviteCode: "INV-ERR-2" });
  await h.db.insert(members).values({ workspaceId: "ws-err", userId: "u-err-owner", role: "owner" });

  const error = await h.db
    .insert(members)
    .values({ workspaceId: "ws-err", userId: "u-err-third", role: "owner" })
    .then(
      () => assert.fail("expected a unique violation"),
      (e: unknown) => e,
    );

  assert.deepEqual(classifyError(error), {
    kind: "unique",
    table: "members",
    columns: ["workspaceId", "role"],
  });
});

it("classifies a violation raised inside db.batch() — the atomicity path", async () => {
  await addUser(h.binding, "u-err-batch");
  await h.db.insert(workspaces).values({ id: "ws-err-batch", ownerId: "u-err-batch", name: "B", inviteCode: "INV-ERR-3" });

  const error = await h.db
    .batch([
      h.db.insert(members).values({ workspaceId: "ws-err-batch", userId: "u-err-batch", role: "owner" }),
      // A second membership for the same account: UNIQUE(userId) fires (SQLite reports
      // the first index it hits, so a duplicate (workspaceId, userId) pair can surface as
      // either `members.userId` or `members.workspaceId, members.userId` — same refusal).
      h.db.insert(members).values({ workspaceId: "ws-err-batch", userId: "u-err-batch", role: "member" }),
    ])
    .then(
      () => assert.fail("expected a unique violation"),
      (e: unknown) => e,
    );

  assert.deepEqual(classifyError(error), {
    kind: "unique",
    table: "members",
    columns: ["userId"],
  });
});

it("leaves a CHECK violation unclassified, so handlers never mistake it for a duplicate", async () => {
  await addUser(h.binding, "u-err-check");
  await h.db.insert(workspaces).values({ id: "ws-err-check", ownerId: "u-err-check", name: "C", inviteCode: "INV-ERR-4" });

  const error = await h.db
    .insert(members)
    .values({ workspaceId: "ws-err-check", userId: "u-err-check", role: "admin" })
    .then(
      () => assert.fail("expected a check violation"),
      (e: unknown) => e,
    );

  assert.equal(classifyError(error), null);
});
