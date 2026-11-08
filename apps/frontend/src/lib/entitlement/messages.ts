import { formatRupiah, rupiahToMinor } from "../../core/money.ts";

/**
 * Entitlement copy in Bahasa Indonesia, imported by the import/export gates and
 * rendered verbatim by the UI (AGENTS §6). One constant, so the second-import
 * refusal and the export refusal always read the same (US-35, US-38). The price
 * goes through `money.ts` like every other figure (AGENTS §7) — never a hand-typed
 * grouping.
 */
const INTRO_PRICE = formatRupiah(rupiahToMinor(49_000));

export const ENTITLEMENT_MESSAGE = {
  /** The free-tier lock: one-time purchase unlocks unlimited imports + export. */
  locked: `Impor berikutnya dan ekspor terkunci. Sekali bayar ${INTRO_PRICE} untuk workspace ini membuka impor tanpa batas dan ekspor. Data yang sudah diimpor tetap bisa Anda lihat.`,
  /** The grant endpoint with the switch off (B-3): purchasable later, no unlock now. */
  paymentDisabled: "Pembelian belum tersedia untuk sementara.",
} as const;
