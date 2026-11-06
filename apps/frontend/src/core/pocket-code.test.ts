import assert from "node:assert/strict";
import test from "node:test";

import { generatePocketCode, isValidPocketCode } from "./pocket-code.ts";

test("accepts the documented shape: 4 digits, 3 letters, 3 alphanumeric", () => {
  for (const code of ["4821kPz7xQ", "0000AAA000", "9999zzz9z9", "1234AbCxyz"]) {
    assert.equal(isValidPocketCode(code), true, code);
  }
});

test("rejects wrong length and wrong structure (US-06 format gate)", () => {
  const invalid = [
    "", // empty
    "4821kPz7x", // 9 characters
    "4821kPz7xQQ", // 11 characters
    "k4821Pz7x", // letter where a digit belongs
    "4821kPz7x!", // punctuation
    "4821kPz7x ", // trailing space is not trimmed here
    "4821  Pz7x", // space inside
    "4821kp7xQz", // digit where a letter belongs
    "4821kPz-7x", // separator
    "4821kPz7xQ\n",
  ];

  for (const code of invalid) assert.equal(isValidPocketCode(code), false, JSON.stringify(code));
});

test("generation always produces the documented structure", () => {
  for (let i = 0; i < 500; i++) {
    const code = generatePocketCode();
    assert.equal(code.length, 10);
    assert.equal(isValidPocketCode(code), true, code);
  }
});

test("generation draws from the injected source, so it is deterministic in tests", () => {
  // `0` is the first character of each set: '0' for digits, 'A' for letters and alphanumeric.
  assert.equal(generatePocketCode(() => 0), "0000AAAAAA");
  assert.equal(generatePocketCode((max) => max - 1), "9999zzz999");
});

test("the default source is the CSPRNG: codes vary between draws", () => {
  const codes = new Set(Array.from({ length: 50 }, () => generatePocketCode()));
  assert.ok(codes.size > 45, `only ${codes.size} distinct codes in 50 draws`);
});
