/**
 * Rupiah, in minor units (1/100 rupiah). Integers only: no float ever holds money.
 * DESIGN.md types every figure as `Rp 1.234.567` in id-ID grouping.
 */

export const MINOR_PER_RUPIAH = 100;

const grouping = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatRupiah(minor: number): string {
  const negative = minor < 0;
  const rupiah = Math.round(Math.abs(minor) / MINOR_PER_RUPIAH);
  return `${negative ? "−" : ""}Rp ${grouping.format(rupiah)}`;
}

/** Whole rupiah to minor units, for form input that collects thousands. */
export function rupiahToMinor(rupiah: number): number {
  return Math.round(rupiah) * MINOR_PER_RUPIAH;
}

/**
 * A form's rupiah input (`"Rp 50.000.000"`, `"50.000.000"`, `"50000000"`) to whole
 * rupiah, or `null` when there is nothing usable. Grouping separators are dropped;
 * a fractional amount (`"50,5"`, `"1.234,56"`) is refused rather than rounded — money
 * is integer rupiah and minor units, never a float.
 */
export function parseRupiahInput(input: string): number | null {
  const trimmed = input.trim();
  if (/[,.]\d{1,2}$/.test(trimmed)) return null;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  const rupiah = Number(digits);
  return Number.isSafeInteger(rupiah) ? rupiah : null;
}
