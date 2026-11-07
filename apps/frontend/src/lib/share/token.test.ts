import assert from "node:assert/strict";
import test from "node:test";

import { SHARE_TOKEN_TTL_DAYS, generateShareToken, shareTokenExpiry, shareTokenState } from "./token.ts";

/**
 * BRD FR-11 / US-32–34: the token is 128-bit app-side randomness held as URL-safe hex,
 * expires after the default TTL, and a revoked token never resolves as active.
 */

test("a token is 32 lowercase hex characters (128 bits, URL-safe)", () => {
  for (let i = 0; i < 50; i++) {
    assert.match(generateShareToken(), /^[0-9a-f]{32}$/);
  }
});

test("generated tokens do not repeat", () => {
  const tokens = new Set(Array.from({ length: 500 }, generateShareToken));
  assert.equal(tokens.size, 500);
});

test("expiry is the default TTL after the given instant", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const expiresAt = shareTokenExpiry(now);

  assert.equal(expiresAt.getTime() - now.getTime(), SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
});

test("state: active until the deadline, expired at it, revoked wins over both", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const deadline = new Date("2026-11-08T00:00:00Z");

  assert.equal(shareTokenState({ expiresAt: deadline, revokedAt: null }, now), "active");
  assert.equal(shareTokenState({ expiresAt: deadline, revokedAt: null }, deadline), "expired");
  assert.equal(
    shareTokenState({ expiresAt: deadline, revokedAt: now }, now),
    "revoked",
  );
});
