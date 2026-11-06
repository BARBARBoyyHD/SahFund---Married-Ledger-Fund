import { z } from "zod";

import { parseRupiahInput, rupiahToMinor } from "../../core/money.ts";

/**
 * US-28 / BRD FR-09: one schema for the commitment form and its route handler
 * (AGENTS §6/§7). Input is rupiah text; output is integer minor units plus a derived
 * `status`. `commitments.status` is NOT NULL but its values are not enumerated in the
 * docs — `unpaid` / `partial` / `paid` is the payment state, derived here once.
 */

const vendor = z
  .string({ error: "Vendor wajib diisi." })
  .trim()
  .min(1, "Vendor wajib diisi.")
  .max(120, "Nama vendor maksimal 120 karakter.");

const total = z
  .string({ error: "Total wajib diisi." })
  .trim()
  .min(1, "Total wajib diisi.")
  .refine(
    (value) => {
      const rupiah = parseRupiahInput(value);
      return rupiah !== null && rupiah > 0;
    },
    "Total belum benar. Tulis angka rupiah lebih dari nol, misalnya 30.000.000.",
  );

/** Empty/omitted means "belum ada DP": 0 is a valid paid amount. */
const paid = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      value === undefined ||
      value === "" ||
      (parseRupiahInput(value) ?? -1) >= 0,
    "Nominal terbayar belum benar. Tulis angka rupiah, misalnya 5.000.000.",
  );

const optionalId = z
  .string({ error: "Pilihan tidak valid." })
  .trim()
  .max(64, "Pilihan tidak valid.")
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value));

const dueOn = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || z.iso.date().safeParse(value).success,
    "Tanggal belum benar. Gunakan format YYYY-MM-DD.",
  )
  .transform((value) => (value === undefined || value === "" ? null : value));

export const createCommitmentSchema = z
  .object({
    vendor,
    categoryId: optionalId,
    total,
    paid,
    dueOn,
  })
  .refine(
    (value) => {
      const totalRupiah = parseRupiahInput(value.total) ?? 0;
      const paidRupiah =
        value.paid === undefined || value.paid === ""
          ? 0
          : (parseRupiahInput(value.paid) ?? 0);
      return paidRupiah <= totalRupiah;
    },
    // Attached to `paid` so the form paints it inline, not as a loose object error.
    { path: ["paid"], message: "Nominal terbayar tidak boleh melebihi total." },
  )
  .transform((value) => {
    const totalMinor = rupiahToMinor(parseRupiahInput(value.total) ?? 0);
    const paidMinor = rupiahToMinor(
      value.paid === undefined || value.paid === ""
        ? 0
        : (parseRupiahInput(value.paid) ?? 0),
    );

    return {
      vendor: value.vendor,
      categoryId: value.categoryId,
      totalMinor,
      paidMinor,
      dueOn: value.dueOn,
      status: paidMinor >= totalMinor ? "paid" : paidMinor > 0 ? "partial" : "unpaid",
    };
  });

export type CreateCommitmentData = z.output<typeof createCommitmentSchema>;
/** What the form holds before submit — rupiah text, not minor units. */
export type CreateCommitmentFormValues = z.input<typeof createCommitmentSchema>;
