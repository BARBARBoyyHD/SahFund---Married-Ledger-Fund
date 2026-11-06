import assert from "node:assert/strict";
import test from "node:test";

import type { Db } from "../db/index.ts";
import { AUTH_LIMIT, allowAttempt, clientKey, windowFor } from "./rate-limit.ts";

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

test("windows are aligned to the epoch, so every isolate derives the same bounds", () => {
  assert.deepEqual(windowFor(1_000, 60_000), { windowStart: 0, expiresAt: 60_000 });
  assert.deepEqual(windowFor(59_999, 60_000), { windowStart: 0, expiresAt: 60_000 });
  // The boundary belongs to the next window, not the previous one.
  assert.deepEqual(windowFor(60_000, 60_000), { windowStart: 60_000, expiresAt: 120_000 });
  // Invite windows are an hour, same rule.
  assert.deepEqual(windowFor(3_600_000 + 5, 3_600_000), {
    windowStart: 3_600_000,
    expiresAt: 7_200_000,
  });
});

test("an unreachable counter fails open and logs no key (design D3)", async () => {
  const warnings: unknown[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  const broken = {
    batch: async () => {
      throw new Error("D1_ERROR: no such table");
    },
  } as unknown as Db;

  try {
    assert.equal(await allowAttempt(broken, "ip:203.0.113.7", AUTH_LIMIT, 0), true);
  } finally {
    console.warn = original;
  }

  assert.equal(warnings.length, 1);
  // Route/prefix only — never the key, never a row (ITA §11.9).
  assert.doesNotMatch(JSON.stringify(warnings), /203\.0\.113\.7/);
});
