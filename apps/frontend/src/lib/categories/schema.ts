import { z } from "zod";

import { parseRupiahInput, rupiahToMinor } from "../../core/money.ts";

/**
 * US-22/US-26: one schema for the category edit (rename + budget) and its route
 * handler (AGENTS §6/§7). The form and the handler share this object.
 *
 * A field that is absent means "leave unchanged"; an empty budget means "clear it"
 * (stored NULL, never a fake zero). Money arrives as the rupiah text the user typed
 * and leaves as integer minor units — the same convention as manual entry and
 * commitments.
 */

const name = z
  .string({ error: "Nama kategori wajib diisi." })
  .trim()
  .min(1, "Nama kategori wajib diisi.")
  .max(60, "Nama kategori maksimal 60 karakter.")
  .optional();

const budget = z
  .string({ error: "Anggaran belum benar." })
  .trim()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || parseRupiahInput(value) !== null,
    "Anggaran belum benar. Tulis angka rupiah, misalnya 12.000.000.",
  )
  .transform((value) =>
    value === undefined
      ? undefined
      : value === ""
        ? null
        : rupiahToMinor(parseRupiahInput(value) ?? 0),
  );

export const updateCategorySchema = z
  .object({ name, budget })
  .transform((value) => ({ name: value.name, budgetMinor: value.budget }));

/** Output carries `budgetMinor`; `undefined` means the field was not sent. */
export type UpdateCategoryData = z.output<typeof updateCategorySchema>;
/** What the form holds before submit — rupiah text, not minor units. */
export type UpdateCategoryFormValues = z.input<typeof updateCategorySchema>;
