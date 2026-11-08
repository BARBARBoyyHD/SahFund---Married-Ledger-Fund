import { z } from "zod";

/**
 * One schema for the import payload, shared by the preview/commit form and the route
 * handler (AGENTS §6/§7). The browser sends *derived rows* only — never file bytes
 * (NFR-01) — already in minor units, because both adapters emit that shape.
 *
 * The 5,000-row cap lives here so every boundary enforces it (US-12, BRD FR-03).
 */

export const MAX_IMPORT_ROWS = 5_000;

const transaction = z
  .object({
    date: z
      .string({ error: "Tanggal transaksi tidak valid." })
      .refine((value) => z.iso.date().safeParse(value).success, "Tanggal transaksi tidak valid."),
    /** `HH:mm`, or empty when the statement prints no time. */
    time: z
      .string()
      .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "Waktu transaksi tidak valid.")
      .default(""),
    description: z
      .string({ error: "Deskripsi transaksi wajib diisi." })
      .trim()
      .min(1, "Deskripsi transaksi wajib diisi.")
      .max(200, "Deskripsi transaksi maksimal 200 karakter."),
    /** Signed minor units: positive = money in. Integer, never a float (NFR-03). */
    amountMinor: z.number({ error: "Nominal transaksi tidak valid." }).int(),
    balanceMinor: z.number({ error: "Saldo transaksi tidak valid." }).int(),
    direction: z.enum(["in", "out"], { error: "Arah transaksi tidak valid." }),
    ref: z.string().trim().max(120).default(""),
  })
  .superRefine((value, context) => {
    if (value.amountMinor === 0) {
      context.addIssue({ code: "custom", message: "Nominal transaksi tidak boleh nol.", path: ["amountMinor"] });
    }
    // The stored direction and the sign must agree; the dedupe tuple and every
    // aggregate read the sign, so a mismatch is a lie about the row.
    if (value.direction !== (value.amountMinor > 0 ? "in" : "out")) {
      context.addIssue({
        code: "custom",
        message: "Arah transaksi tidak cocok dengan nominalnya.",
        path: ["direction"],
      });
    }
  });

export const importStatementSchema = z.object({
  /** Adapter id — `jago` or `csv` (ADR-06). Stored on every row as `source`. */
  sourceId: z.string().trim().min(1).max(40),
  pocketName: z
    .string({ error: "Kantong wajib dipilih." })
    .trim()
    .min(1, "Kantong wajib dipilih.")
    .max(80, "Nama kantong maksimal 80 karakter."),
  period: z.string().trim().max(40).nullable().default(null),
  openingBalanceMinor: z.number().int(),
  totalInMinor: z.number().int(),
  totalOutMinor: z.number().int(),
  closingBalanceMinor: z.number().int(),
  transactions: z
    .array(transaction)
    .min(1, "Tidak ada transaksi pada impor ini.")
    .max(MAX_IMPORT_ROWS, `Maksimal ${MAX_IMPORT_ROWS.toLocaleString("id-ID")} transaksi per impor.`),
  /**
   * The browser's own verdict. Accepted so the client can post one object, then
   * ignored: the server recomputes with `core/reconcile.ts` (US-16).
   */
  reconciliation: z.unknown().optional(),
});

export type ImportStatementData = z.output<typeof importStatementSchema>;
/** What the preview posts: the same payload, before defaults are applied. */
export type ImportStatementInput = z.input<typeof importStatementSchema>;
