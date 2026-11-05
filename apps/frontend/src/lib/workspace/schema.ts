import { z } from "zod";

import { isValidPocketCode } from "../../core/pocket-code.ts";
import { parseRupiahInput, rupiahToMinor } from "../../core/money.ts";
import { emailField } from "../auth/schema.ts";

/**
 * One schema per workspace payload, shared by the form and the handler (AGENTS §6/§7).
 * Messages are the copy the user reads, in Bahasa Indonesia.
 *
 * The request carries what the user typed (`budgetTarget` as rupiah text); the parsed
 * output carries what the database stores (`budgetTargetMinor`, integer minor units,
 * NFR-03). A form validates with the same schema for inline errors, then posts the raw
 * values — never the transformed ones.
 */

const workspaceName = z
  .string()
  .trim()
  .min(2, "Nama workspace minimal 2 karakter.")
  .max(80, "Nama workspace maksimal 80 karakter.");

/** `YYYY-MM-DD`, the column's ISO text form. An empty input means "not set". */
const weddingDate = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.iso.date().safeParse(value).success,
    "Tanggal belum benar. Gunakan format YYYY-MM-DD.",
  )
  .transform((value) => (value === "" ? null : value));

/** Rupiah as typed in a form; `null` output means "no target". */
const budgetTarget = z
  .string()
  .trim()
  .max(20, "Nominal terlalu besar.")
  .refine(
    (value) => value === "" || parseRupiahInput(value) !== null,
    "Nominal belum benar. Tulis angka rupiah, misalnya 50.000.000.",
  )
  .transform((value) => {
    const rupiah = value === "" ? null : parseRupiahInput(value);
    return rupiah === null ? null : rupiahToMinor(rupiah);
  });

export const createWorkspaceSchema = z
  .object({
    name: workspaceName,
    weddingDate: weddingDate.optional(),
    budgetTarget: budgetTarget.optional(),
  })
  .transform((value) => ({
    name: value.name,
    weddingDate: value.weddingDate ?? null,
    budgetTargetMinor: value.budgetTarget ?? null,
  }));

export const joinWorkspaceSchema = z.object({
  code: z
    .string()
    .trim()
    .refine(
      isValidPocketCode,
      "Kode undangan harus 10 karakter: 4 angka, 3 huruf, lalu 3 huruf atau angka.",
    ),
});

export const updateWorkspaceDetailsSchema = z
  .object({
    weddingDate: weddingDate.optional(),
    budgetTarget: budgetTarget.optional(),
  })
  .refine((value) => value.weddingDate !== undefined || value.budgetTarget !== undefined, {
    message: "Isi tanggal pernikahan atau target anggaran yang ingin diubah.",
  })
  .transform((value) => ({
    weddingDate: value.weddingDate,
    budgetTargetMinor: value.budgetTarget,
  }));

export const inviteSchema = z.object({ email: emailField });

export type CreateWorkspaceData = z.output<typeof createWorkspaceSchema>;
/** What a create form holds before submit — rupiah text, not minor units. */
export type CreateWorkspaceFormValues = z.input<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
export type UpdateWorkspaceDetailsData = z.output<typeof updateWorkspaceDetailsSchema>;
export type UpdateWorkspaceDetailsFormValues = z.input<typeof updateWorkspaceDetailsSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
