/**
 * Rupiah, in minor units (1/100 rupiah). Integers only: no float ever holds money.
 * DESIGN.md types every figure as `Rp 1.234.567` in id-ID grouping.
 */

export const MINOR_PER_RUPIAH = 100;

/**
 * Largest whole-rupiah amount whose minor product is still an exact integer
 * (2^53-1 minor units ≈ Rp 90 trillion) — SPEC §10 E4. Beyond it the multiply
 * silently rounds, so both entry points refuse instead of storing a wrong number.
 */
const MAX_RUPIAH = Math.floor(Number.MAX_SAFE_INTEGER / MINOR_PER_RUPIAH);

const grouping = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatRupiah(minor: number): string {
  const negative = minor < 0;
  const rupiah = Math.round(Math.abs(minor) / MINOR_PER_RUPIAH);
  return `${negative ? "−" : ""}Rp ${grouping.format(rupiah)}`;
}

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // The column is a calendar date (`YYYY-MM-DD`); UTC keeps it from sliding a day.
  timeZone: "UTC",
});

/** The `date` column's ISO text to the id-ID form the user reads (AGENTS §6). */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

/** Whole rupiah to minor units, for form input that collects thousands. */
export function rupiahToMinor(rupiah: number): number {
  const whole = Math.round(rupiah);
  if (!Number.isSafeInteger(whole) || Math.abs(whole) > MAX_RUPIAH) {
    throw new RangeError("rupiahToMinor: amount exceeds the safe minor-unit range (SPEC E4)");
  }
  return whole * MINOR_PER_RUPIAH;
}

/**
 * A form's rupiah input (`"Rp 50.000.000"`, `"50.000.000"`, `"50000000"`) to whole
 * rupiah, or `null` when there is nothing usable. Grouping separators are dropped;
 * a fractional amount (`"50,5"`, `"1.234,56"`) is refused rather than rounded — money
 * is integer rupiah and minor units, never a float. An amount whose minor product
 * would exceed 2^53-1 is refused too (SPEC §10 E4).
 */
export function parseRupiahInput(input: string): number | null {
  const trimmed = input.trim();
  if (/[,.]\d{1,2}$/.test(trimmed)) return null;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  const rupiah = Number(digits);
  return Number.isSafeInteger(rupiah) && rupiah <= MAX_RUPIAH ? rupiah : null;
}
