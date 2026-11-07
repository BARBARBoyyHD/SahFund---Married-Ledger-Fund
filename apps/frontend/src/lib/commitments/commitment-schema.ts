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

export type CommitmentStatus = "unpaid" | "partial" | "paid";

/**
 * The one derivation of a commitment's payment state from its amounts (US-28). Used by
 * create and update, so a pelunasan recorded either way reads the same in the list.
 */
export function commitmentStatus(paidMinor: number, totalMinor: number): CommitmentStatus {
  return paidMinor >= totalMinor ? "paid" : paidMinor > 0 ? "partial" : "unpaid";
}

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
      status: commitmentStatus(paidMinor, totalMinor),
    };
  });

export type CreateCommitmentData = z.output<typeof createCommitmentSchema>;
/** What the form holds before submit — rupiah text, not minor units. */
export type CreateCommitmentFormValues = z.input<typeof createCommitmentSchema>;

/**
 * US-28 settlement update (DP, then pelunasan): the same rupiah-text inputs as creation
 * and a server-derived status. `total` and `paid` are both required because they are the
 * two halves of the status; the caller (edit dialog) has both, and demanding them avoids
 * a read-current-row-then-write window (and a silent paid→0). `paid` may exceed `total`:
 * an overrun is stored as-is and shown unclamped in the reports, never clamped here.
 * (Creation caps paid at total at the form boundary; this is the settlement path where
 * costs may grow.) `dueOn` omitted means "unchanged", `""` clears it — a settlement must
 * never silently wipe a due date it was not asked about.
 */
const settledPaid = z
  .string({ error: "Nominal terbayar belum benar. Tulis angka rupiah, misalnya 5.000.000." })
  .trim()
  .refine(
    (value) => value === "" || (parseRupiahInput(value) ?? -1) >= 0,
    "Nominal terbayar belum benar. Tulis angka rupiah, misalnya 5.000.000.",
  );

const updatableDueOn = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || z.iso.date().safeParse(value).success,
    "Tanggal belum benar. Gunakan format YYYY-MM-DD.",
  )
  .transform((value) => (value === undefined ? undefined : value === "" ? null : value));

export const updateCommitmentSchema = z
  .object({ total, paid: settledPaid, dueOn: updatableDueOn })
  .transform((value) => {
    const totalMinor = rupiahToMinor(parseRupiahInput(value.total) ?? 0);
    const paidMinor = rupiahToMinor(value.paid === "" ? 0 : (parseRupiahInput(value.paid) ?? 0));

    return {
      totalMinor,
      paidMinor,
      dueOn: value.dueOn,
      status: commitmentStatus(paidMinor, totalMinor),
    };
  });

export type UpdateCommitmentData = z.output<typeof updateCommitmentSchema>;
/** What the edit form holds before submit — rupiah text, not minor units. */
export type UpdateCommitmentFormValues = z.input<typeof updateCommitmentSchema>;
