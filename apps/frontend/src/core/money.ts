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
