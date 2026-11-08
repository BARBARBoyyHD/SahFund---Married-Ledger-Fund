import assert from "node:assert/strict";
import test from "node:test";

import { matchDuplicatePayments } from "./duplicate-payments.ts";

const dp = { commitmentId: "commit-1", paidOn: "2026-11-10", amountMinor: 5000000 };

test("same amount within three days on either side is surfaced", () => {
  const pairs = matchDuplicatePayments(
    [dp],
    [
      { transactionId: "tx-same-day", occurredOn: "2026-11-10", amountMinor: -5000000 },
      { transactionId: "tx-three-before", occurredOn: "2026-11-07", amountMinor: -5000000 },
      { transactionId: "tx-three-after", occurredOn: "2026-11-13", amountMinor: -5000000 },
    ],
  );

  assert.deepEqual(
    pairs.map((pair) => pair.transactionId),
    ["tx-same-day", "tx-three-before", "tx-three-after"],
  );
  assert.equal(pairs[0]?.amountMinor, 5000000);
  assert.equal(pairs[0]?.commitmentId, "commit-1");
});

test("the same amount outside the window is not a match", () => {
  const pairs = matchDuplicatePayments(
    [dp],
    [
      { transactionId: "tx-too-early", occurredOn: "2026-11-06", amountMinor: -5000000 },
      { transactionId: "tx-too-late", occurredOn: "2026-11-14", amountMinor: -5000000 },
    ],
  );

  assert.deepEqual(pairs, []);
});

test("a different amount on the same day is not a match", () => {
  const pairs = matchDuplicatePayments(
    [dp],
    [{ transactionId: "tx-other", occurredOn: "2026-11-10", amountMinor: -5000001 }],
  );

  assert.deepEqual(pairs, []);
});

test("money in does not match a payment; a zero amount never matches anything", () => {
  const pairs = matchDuplicatePayments(
    [{ commitmentId: "commit-zero", paidOn: "2026-11-10", amountMinor: 0 }],
    [
      { transactionId: "tx-in", occurredOn: "2026-11-10", amountMinor: 5000000 },
      { transactionId: "tx-zero", occurredOn: "2026-11-10", amountMinor: 0 },
    ],
  );

  assert.deepEqual(pairs, []);
});

test("one payment can surface against two identical ledger rows (both are suspects)", () => {
  const pairs = matchDuplicatePayments(
    [dp],
    [
      { transactionId: "tx-a", occurredOn: "2026-11-09", amountMinor: -5000000 },
      { transactionId: "tx-b", occurredOn: "2026-11-11", amountMinor: -5000000 },
    ],
  );

  assert.deepEqual(
    pairs.map((pair) => pair.transactionId),
    ["tx-a", "tx-b"],
  );
});

test("an invalid date is never treated as a match", () => {
  const pairs = matchDuplicatePayments(
    [{ ...dp, paidOn: "bukan-tanggal" }],
    [{ transactionId: "tx-a", occurredOn: "2026-11-10", amountMinor: -5000000 }],
  );

  assert.deepEqual(pairs, []);
});
