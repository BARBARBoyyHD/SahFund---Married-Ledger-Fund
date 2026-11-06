import type { ZodError } from "zod";

/**
 * Zod plumbing shared by forms and handlers (AGENTS §6/§7). No `next/server` import:
 * a client form uses the same helper to paint its own inline errors.
 */

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First message per field, keyed by field name. */
export function fieldErrors<T extends Record<string, unknown>>(error: ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
