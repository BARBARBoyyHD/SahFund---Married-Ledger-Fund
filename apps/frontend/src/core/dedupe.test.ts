import assert from "node:assert/strict";
import test from "node:test";

import { dedupeHash } from "./dedupe.ts";

/**
 * The one dedupe tuple is pinned by ERD §5 / ITA §5:
 * `sha256(workspaceId | date | time | amountMinor | balanceMinor | ref)`.
 * These tests lock the component order and the manual-row stability, so import and
 * manual entry cannot drift apart silently.
 */

const manual = {
  workspaceId: "ws-1",
  date: "2026-11-06",
  time: "",
  amountMinor: -25_000_000,
  balanceMinor: 0,
  ref: "",
} as const;

test("same components produce the same 64-character lowercase hex hash", () => {
  const hash = dedupeHash(manual);
  assert.equal(hash, dedupeHash({ ...manual }));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("changing any one component changes the hash", () => {
  const base = dedupeHash(manual);
  const changes = [
    { workspaceId: "ws-2" },
    { date: "2026-11-07" },
    { time: "08:30" },
    { amountMinor: 25_000_000 },
    { balanceMinor: 1 },
    { ref: "BCA-123" },
  ];

  for (const change of changes) {
    assert.notEqual(dedupeHash({ ...manual, ...change }), base, JSON.stringify(change));
  }
});

test("a manual row is deterministic — empty time/ref and balance 0 are stable", () => {
  // The same date + amount is the whole tuple for a manual row, so re-submitting it
  // is a conflict, not a second row (the known shortcut documented in the service).
  assert.equal(
    dedupeHash(manual),
    dedupeHash({
      workspaceId: "ws-1",
      date: "2026-11-06",
      time: "",
      amountMinor: -25_000_000,
      balanceMinor: 0,
      ref: "",
    }),
  );
});

test("the hash is exactly sha256 over the pipe-delimited tuple", () => {
  // Locked literal: sha256("ws-1|2026-11-06||-25000000|0|").
  assert.equal(
    dedupeHash(manual),
    "cbb32053740230f8343806c539d3036e01b43290722a6fdbe42d6651b85c1fb4",
  );
});
