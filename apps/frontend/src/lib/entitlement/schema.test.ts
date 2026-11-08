import assert from "node:assert/strict";
import test from "node:test";

import { grantEntitlementSchema } from "./schema.ts";

/** US-37: the purchase payload is mechanism-agnostic — an order id and a workspace. */

test("accepts and trims a completed-purchase payload", () => {
  assert.deepEqual(
    grantEntitlementSchema.parse({ workspaceId: " ws-1 ", orderId: " order-123 " }),
    { workspaceId: "ws-1", orderId: "order-123" },
  );
});

test("refuses a missing order id with a Bahasa Indonesia message", () => {
  const result = grantEntitlementSchema.safeParse({ workspaceId: "ws-1" });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "ID pesanan wajib diisi.");
});

test("refuses an empty workspace id — the grant is always workspace-scoped", () => {
  const result = grantEntitlementSchema.safeParse({ workspaceId: "  ", orderId: "order-1" });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Workspace tidak valid.");
});
