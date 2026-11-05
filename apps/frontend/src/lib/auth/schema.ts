import { z } from "zod";

/**
 * One schema per payload, shared by the form and by whatever handles the POST (AGENTS.md §6).
 * Messages are the copy the user reads, in Bahasa Indonesia.
 */

const email = z
  .string()
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
  email,
  password,
});

export const signInSchema = z.object({
  email,
  // Sign-in does not restate the length policy: that would tell a stranger our rules.
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First message per field, keyed by field name. */
export function fieldErrors<T extends Record<string, unknown>>(error: z.ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
