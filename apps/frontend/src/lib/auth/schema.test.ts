import assert from "node:assert/strict";
import test from "node:test";

import { safeNext, signInSchema } from "./schema.ts";

/**
 * The sign-in `next` is the only redirect target a request can influence, so this is
 * the open-redirect gate (design D8): same-origin relative paths only.
 */

test("keeps a same-origin relative path", () => {
  assert.equal(safeNext("/dashboard"), "/dashboard");
  assert.equal(safeNext("/join?code=1234ABC789"), "/join?code=1234ABC789");
  assert.equal(safeNext("/w/ws-1/settings"), "/w/ws-1/settings");
});

test("rejects every off-site shape", () => {
  const offSite = [
    "https://evil.example/dashboard", // absolute URL with a scheme
    "http://evil.example",
    "//evil.example", // protocol-relative
    "///evil.example",
    "/\\evil.example", // browsers normalise `\` to `/`
    "\\\\evil.example",
    "/\t/evil.example", // tabs/newlines are stripped before the URL resolves
    "/\n/evil.example",
    "javascript:alert(1)",
    "dashboard", // not rooted: would resolve relative to the current page
    "",
    "   ",
  ];

  for (const value of offSite) assert.equal(safeNext(value), null, `accepted ${JSON.stringify(value)}`);
});

test("rejects non-strings and absurd lengths", () => {
  for (const value of [undefined, null, 42, {}, ["/dashboard"]]) assert.equal(safeNext(value), null);
  assert.equal(safeNext(`/${"a".repeat(512)}`), null);
});

test("the sign-in schema carries `next` without making it required", () => {
  const withoutNext = signInSchema.safeParse({ email: "a@b.co", password: "x" });
  assert.equal(withoutNext.success, true);

  const withNext = signInSchema.safeParse({ email: "a@b.co", password: "x", next: "/join?code=1" });
  assert.equal(withNext.success, true);
  assert.equal(withNext.success && withNext.data.next, "/join?code=1");
});
