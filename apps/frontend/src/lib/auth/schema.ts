import { z } from "zod";

/**
 * One schema per payload, shared by the form and by whatever handles the POST (AGENTS.md §6).
 * Messages are the copy the user reads, in Bahasa Indonesia.
 */

export const emailField = z
  .string({ error: "Email wajib diisi." })
  .trim()
  .min(1, "Email wajib diisi.")
  .max(254, "Email terlalu panjang.")
  .refine((value) => z.email().safeParse(value).success, "Format email belum benar.");

const password = z.string().min(10, "Kata sandi minimal 10 karakter.");

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(80, "Nama maksimal 80 karakter."),
  email: emailField,
  password,
});

export const signInSchema = z.object({
  email: emailField,
  // Sign-in does not restate the length policy: that would tell a stranger our rules.
  password: z.string().min(1, "Kata sandi wajib diisi."),
  /** Where to land afterwards (US-53 join link). Sanitised by `safeNext`, never trusted. */
  next: z.string().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * The only `next` a sign-in may return to: a same-origin relative path (design D8).
 * `//host` is protocol-relative and `/\host` is normalised to it by browsers; a scheme
 * cannot follow a leading slash. Anything else is dropped — the caller falls back.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Backslashes, tabs and newlines are rewritten by URL parsers before they resolve.
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}
