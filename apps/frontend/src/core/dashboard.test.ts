import assert from "node:assert/strict";
import test from "node:test";
import {
  daysUntil,
  jakartaDay,
  monthBounds,
  perMember,
  percent,
  percentChange,
  toMinor,
} from "./dashboard.ts";
import { rupiahToMinor } from "./money.ts";

test("percent rounds to a whole number and survives a zero denominator", () => {
  assert.equal(percent(87500, 120000), 73);
  assert.equal(percent(30500000, 30000000), 102);
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(5, 0), 0);
});

test("percentChange is null until there is a previous month to compare", () => {
  assert.equal(percentChange(12, 10), 20);
  assert.equal(percentChange(8, 10), -20);
  assert.equal(percentChange(12, 0), null);
});

test("daysUntil counts calendar days and goes negative after the wedding", () => {
  assert.equal(daysUntil("2027-06-03", "2026-11-06"), 209);
  assert.equal(daysUntil("2026-11-06", "2026-11-06"), 0);
  assert.equal(daysUntil("2026-11-05", "2026-11-06"), -1);
});

test("jakartaDay shifts the instant to UTC+7 before taking the date", () => {
  assert.equal(jakartaDay(new Date("2026-11-05T17:30:00Z")), "2026-11-06");
  assert.equal(jakartaDay(new Date("2026-11-05T16:59:00Z")), "2026-11-05");
});

test("monthBounds covers both months, including December and leap February", () => {
  assert.deepEqual(monthBounds("2026-11-06"), {
    thisStart: "2026-11-01",
    thisEnd: "2026-11-30",
    lastStart: "2026-10-01",
    lastEnd: "2026-10-31",
  });
  assert.deepEqual(monthBounds("2027-01-15"), {
    thisStart: "2027-01-01",
    thisEnd: "2027-01-31",
    lastStart: "2026-12-01",
    lastEnd: "2026-12-31",
  });
  assert.equal(monthBounds("2028-02-10").thisEnd, "2028-02-29");
  assert.equal(monthBounds("2027-02-10").thisEnd, "2027-02-28");
});

test("toMinor reads SQL sums without a float touching the number", () => {
  assert.equal(toMinor("123456789"), 123456789);
  assert.equal(toMinor(123456789), 123456789);
  assert.equal(toMinor(null), 0);
  assert.equal(toMinor(undefined), 0);
});

test("perMember splits a monthly gap into whole rupiah per person", () => {
  assert.equal(perMember(rupiahToMinor(2_500_000), 2), 1_250_000 * 100);
  // 10.000.001 minor over two people rounds up to the next whole rupiah.
  assert.equal(perMember(10_000_001, 2), 50_001 * 100);
  assert.equal(perMember(0, 2), 0);
  assert.equal(perMember(1000, 0), 0);
});
