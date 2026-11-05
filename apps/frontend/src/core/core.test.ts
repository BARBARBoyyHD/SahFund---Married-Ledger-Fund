import assert from "node:assert/strict";
import test from "node:test";
import { forecast, monthsUntil } from "./forecast.ts";
import { formatDate, formatRupiah, parseRupiahInput, rupiahToMinor } from "./money.ts";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

test("formatRupiah groups in id-ID and keeps the sign", () => {
  assert.equal(formatRupiah(123456700), "Rp 1.234.567");
  assert.equal(formatRupiah(0), "Rp 0");
  assert.equal(formatRupiah(-5000000), "−Rp 50.000");
});

test("formatDate renders a calendar date in id-ID without shifting the day", () => {
  assert.equal(formatDate("2027-06-03"), "3 Juni 2027");
  assert.equal(formatDate("2026-11-05"), "5 November 2026");
});

test("rupiahToMinor never produces a fraction", () => {
  assert.equal(rupiahToMinor(49000), 4900000);
  assert.equal(formatRupiah(rupiahToMinor(49000)), "Rp 49.000");
});

test("parseRupiahInput accepts how people type rupiah and refuses fractions", () => {
  assert.equal(parseRupiahInput("50.000.000"), 50_000_000);
  assert.equal(parseRupiahInput("Rp 50.000.000"), 50_000_000);
  assert.equal(parseRupiahInput("50000000"), 50_000_000);
  assert.equal(parseRupiahInput(" 1 234 567 "), 1_234_567);

  // Empty is "no value", not zero — the caller decides what that means.
  assert.equal(parseRupiahInput(""), null);
  assert.equal(parseRupiahInput("Rp"), null);
  // Minor units are not a thing users type: a fractional rupiah is refused, not rounded.
  assert.equal(parseRupiahInput("50,5"), null);
  assert.equal(parseRupiahInput("1.234,56"), null);
  // Beyond 2^53 the digits stop being exact, so refuse instead of storing a wrong number.
  assert.equal(parseRupiahInput("99999999999999999999"), null);
});

test("monthsUntil counts whole months and never returns zero", () => {
  assert.equal(monthsUntil(day("2027-06-01"), day("2026-11-03")), 6);
  assert.equal(monthsUntil(day("2027-06-01"), day("2026-12-03")), 5);
  assert.equal(monthsUntil(day("2026-11-01"), day("2026-11-03")), 1);
});

test("funded when the projected deposits cover the remaining bills", () => {
  const f = forecast({
    balanceMinor: rupiahToMinor(50_000_000),
    committedUnpaidMinor: rupiahToMinor(20_000_000),
    remainingBudgetMinor: 0,
    plannedMonthlyDepositMinor: rupiahToMinor(5_000_000),
    weddingDate: day("2027-06-03"),
    today: day("2026-11-03"),
  });
  assert.equal(f.status, "funded");
  assert.equal(f.shortfallAmountMinor, 0);
  assert.equal(f.requiredMonthlyDepositMinor, 0);
});

test("shortfall names the gap and the monthly deposit that closes it", () => {
  const f = forecast({
    balanceMinor: rupiahToMinor(10_000_000),
    committedUnpaidMinor: rupiahToMinor(60_000_000),
    remainingBudgetMinor: rupiahToMinor(10_000_000),
    plannedMonthlyDepositMinor: rupiahToMinor(2_000_000),
    weddingDate: day("2027-06-03"),
    today: day("2026-11-03"),
  });
  assert.equal(f.monthsLeft, 7);
  assert.equal(f.status, "shortfall");
  // need 70jt, balance 10jt + 7 x 2jt = 24jt, gap 46jt; 60jt / 7 months = 8.571.429 rounded up
  assert.equal(f.shortfallAmountMinor, rupiahToMinor(46_000_000));
  assert.equal(f.requiredMonthlyDepositMinor, 8_571_429 * 100);
});
