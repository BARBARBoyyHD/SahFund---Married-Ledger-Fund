import assert from "node:assert/strict";
import { it } from "node:test";

import { deleteAccountSchema } from "./deletion.ts";

/** US-40: the two deliberate fields — the confirm word and, when shared, the workspace path. */
it("account delete requires the confirm word", () => {
  assert.equal(deleteAccountSchema.safeParse({}).success, false);
  assert.equal(deleteAccountSchema.safeParse({ confirm: "hapus" }).success, false);
  assert.deepEqual(deleteAccountSchema.parse({ confirm: "hapus-akun" }), { confirm: "hapus-akun" });
});

it("account delete accepts only the stated workspace path", () => {
  const parsed = deleteAccountSchema.safeParse({ confirm: "hapus-akun", workspacePath: "delete-with-it" });
  assert.equal(parsed.success, true);

  const unknown = deleteAccountSchema.safeParse({ confirm: "hapus-akun", workspacePath: "handover" });
  assert.equal(unknown.success, false);
  assert.match(unknown.error?.issues[0]?.message ?? "", /dihapus bersama akun/, "copy is Bahasa Indonesia");
});
