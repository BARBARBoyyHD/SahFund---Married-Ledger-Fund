import assert from "node:assert/strict";
import test from "node:test";

import { allowAuthAttempt, clientKey } from "./rate-limit.ts";

const IP = "203.0.113.7";

test("ten attempts pass, the eleventh is refused (NFR-02)", () => {
  for (let i = 0; i < 10; i++) assert.equal(allowAuthAttempt(IP, 1_000), true);
  assert.equal(allowAuthAttempt(IP, 1_000), false);
});

test("the window rolls: a minute later the same IP is allowed again", () => {
  for (let i = 0; i < 10; i++) allowAuthAttempt("198.51.100.1", 5_000);
  assert.equal(allowAuthAttempt("198.51.100.1", 5_000), false);
  assert.equal(allowAuthAttempt("198.51.100.1", 65_001), true);
});

test("keys are independent", () => {
  for (let i = 0; i < 10; i++) allowAuthAttempt("192.0.2.1", 9_000);
  assert.equal(allowAuthAttempt("192.0.2.1", 9_000), false);
  assert.equal(allowAuthAttempt("192.0.2.2", 9_000), true);
});

test("clientKey prefers the edge IP and falls back to unknown", () => {
  assert.equal(
    clientKey(new Request("https://x.test", { headers: { "cf-connecting-ip": "1.2.3.4" } })),
    "1.2.3.4",
  );
  assert.equal(
    clientKey(new Request("https://x.test", { headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" } })),
    "5.6.7.8",
  );
  assert.equal(clientKey(new Request("https://x.test")), "unknown");
});
