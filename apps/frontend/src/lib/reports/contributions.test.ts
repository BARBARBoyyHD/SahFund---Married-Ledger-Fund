import assert from "node:assert/strict";
import test from "node:test";

import { mergeContributionSums } from "./contributions.ts";

test("in/out/net stay exact in integer minor units, even near the safe-integer ceiling", () => {
  const lines = mergeContributionSums(
    [
      { memberId: "user-a", total: "9007199254740991" },
      { memberId: "user-b", total: "250000" },
    ],
    [
      { memberId: "user-a", total: "-100000" },
      { memberId: "user-b", total: "-250000" },
    ],
  );

  assert.deepEqual(lines, [
    // Exact, not a float round-trip: 2^53-1 minus 100.000 minor units.
    { memberId: "user-a", inMinor: 9007199254740991, outMinor: 100000, netMinor: 9007199254640991 },
    { memberId: "user-b", inMinor: 250000, outMinor: 250000, netMinor: 0 },
  ]);
});

test("unattributed money is its own line, never folded into a member", () => {
  const lines = mergeContributionSums(
    [
      { memberId: "user-a", total: "100000" },
      { memberId: null, total: "300000" },
    ],
    [{ memberId: null, total: "-50000" }],
  );

  assert.deepEqual(lines, [
    { memberId: "user-a", inMinor: 100000, outMinor: 0, netMinor: 100000 },
    { memberId: null, inMinor: 300000, outMinor: 50000, netMinor: 250000 },
  ]);
  // The member line holds only that member's money.
  assert.equal(lines[0]?.netMinor, 100000);
});

test("a member with only money out still gets a line, and unattributed sorts last", () => {
  const lines = mergeContributionSums(
    [{ memberId: null, total: "1000" }],
    [
      { memberId: "user-c", total: "-7500" },
      { memberId: null, total: "-500" },
    ],
  );

  assert.deepEqual(lines, [
    { memberId: "user-c", inMinor: 0, outMinor: 7500, netMinor: -7500 },
    { memberId: null, inMinor: 1000, outMinor: 500, netMinor: 500 },
  ]);
});

test("no rows means no lines — zero is never invented", () => {
  assert.deepEqual(mergeContributionSums([], []), []);
});
