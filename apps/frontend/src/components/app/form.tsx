import type { ReactNode } from "react";

import { INPUT } from "@/components/landing/ui";

/**
 * The label/hint/error block every form field shares. The caller owns the `<input>`
 * (and its `aria-describedby`), so the id contract stays visible at the call site.
 * Server-safe: no hooks, so a client form can use it too.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-small font-bold text-ink">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 44px field, danger border when its own error is showing (matches the login form). */
export function inputClass(error?: string) {
  return `${INPUT} ${
    error ? "border-danger focus:border-danger" : "border-gold-line focus:border-emerald"
  }`;
}

/** `aria-describedby` for a field that may have a hint, an error, or both. */
export function describedBy(id: string, options: { hint?: boolean; error?: string }) {
  const ids = [options.hint ? `${id}-hint` : null, options.error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}

/** The one place a failed request's message is painted: verbatim, never a toast. */
export function FormMessage({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive">
      {message ? (
        <p
          role="alert"
          className="mb-5 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-small font-semibold text-danger"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
