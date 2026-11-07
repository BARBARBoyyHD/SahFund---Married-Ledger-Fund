import { z } from "zod";

import { parseRupiahInput, rupiahToMinor } from "../../core/money.ts";

/**
 * US-21 / BRD FR-05: one schema for the manual-entry form and the route handler
 * (AGENTS §6/§7). The request carries what the user typed — a positive rupiah amount
 * plus a `direction` — and the parsed output carries the stored row: a signed
 * `amountMinor` (positive = money in), integer minor units, never a float.
 */

const occurredOn = z
  .string({ error: "Tanggal wajib diisi." })
  .trim()
  .min(1, "Tanggal wajib diisi.")
  .refine(
    (value) => z.iso.date().safeParse(value).success,
    "Tanggal belum benar. Gunakan format YYYY-MM-DD.",
  );

const description = z
  .string({ error: "Deskripsi wajib diisi." })
  .trim()
  .min(1, "Deskripsi wajib diisi.")
  .max(200, "Deskripsi maksimal 200 karakter.");

const amount = z
  .string({ error: "Nominal wajib diisi." })
  .trim()
  .min(1, "Nominal wajib diisi.")
  .refine(
    (value) => {
      const rupiah = parseRupiahInput(value);
      return rupiah !== null && rupiah > 0;
    },
    "Nominal belum benar. Tulis angka rupiah lebih dari nol, misalnya 250.000.",
  );

/** A foreign key chosen from a `<select>`; empty means "none" and stores null. */
const optionalId = z
  .string({ error: "Pilihan tidak valid." })
  .trim()
  .max(64, "Pilihan tidak valid.")
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value));

export const createManualTransactionSchema = z
  .object({
    occurredOn,
    description,
    /** `out` = money out (the signed amount becomes negative), `in` = money in. */
    direction: z.enum(["in", "out"], { error: "Pilih jenis transaksi." }),
    amount,
    categoryId: optionalId,
    memberId: optionalId,
  })
  .transform((value) => {
    // The field refine already guarantees a positive whole-rupiah amount.
    const minor = rupiahToMinor(parseRupiahInput(value.amount) ?? 0);
    return {
      occurredOn: value.occurredOn,
      description: value.description,
      direction: value.direction,
      amountMinor: value.direction === "out" ? -minor : minor,
      categoryId: value.categoryId,
      memberId: value.memberId,
    };
  });

export type CreateManualTransactionData = z.output<typeof createManualTransactionSchema>;
/** What the form holds before submit — rupiah text and a direction, not minor units. */
export type CreateManualTransactionFormValues = z.input<typeof createManualTransactionSchema>;

/**
 * US-20 re-categorise: an imported row's amounts/dates are statement facts, so only the
 * classification fields are accepted. Unlike creation, an omitted field means "leave
 * unchanged" (a PATCH), while an empty string clears the reference.
 */
const updatableId = z
  .string({ error: "Pilihan tidak valid." })
  .trim()
  .max(64, "Pilihan tidak valid.")
  .optional()
  .transform((value) => (value === "" ? null : value));

export const updateTransactionClassificationSchema = z.object({
  categoryId: updatableId,
  memberId: updatableId,
});

export type UpdateTransactionClassificationData = z.output<
  typeof updateTransactionClassificationSchema
>;
export type UpdateTransactionClassificationFormValues = z.input<
  typeof updateTransactionClassificationSchema
>;

