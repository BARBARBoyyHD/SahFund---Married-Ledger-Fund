import assert from "node:assert/strict";
import test from "node:test";

import { classifyError } from "./index.ts";

/** What D1 + Drizzle actually hand a handler (pinned against local D1 in test/integration). */
const d1Error = (sqliteMessage: string) => {
  const error = new Error("Failed query: insert into ...");
  (error as { cause?: unknown }).cause = { message: sqliteMessage };
  return error;
};

test("classifies a single-column unique violation", () => {
  assert.deepEqual(
    classifyError(
      d1Error(
        "D1_ERROR: UNIQUE constraint failed: workspaces.inviteCode: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)",
      ),
    ),
    { kind: "unique", table: "workspaces", columns: ["inviteCode"] },
  );
});

test("classifies a composite unique index, keeping every column in order", () => {
  assert.deepEqual(
    classifyError(
      d1Error("D1_ERROR: UNIQUE constraint failed: members.workspaceId, members.role: SQLITE_CONSTRAINT"),
    ),
    { kind: "unique", table: "members", columns: ["workspaceId", "role"] },
  );
});

test("anything that is not a unique violation is null", () => {
  const notUnique = [
    d1Error("D1_ERROR: CHECK constraint failed: members_role_check: SQLITE_CONSTRAINT"),
    d1Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"),
    d1Error("D1_ERROR: no such table: rate_limits"),
    new Error("fetch failed"),
    "not an error",
    null,
    undefined,
  ];

  for (const error of notUnique) assert.equal(classifyError(error), null);
});

test("a malformed unique message is null, never a half-parsed table", () => {
  assert.equal(classifyError(d1Error("D1_ERROR: UNIQUE constraint failed: : SQLITE_CONSTRAINT")), null);
  assert.equal(classifyError(d1Error("D1_ERROR: UNIQUE constraint failed: members")), null);
});
