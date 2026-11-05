"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  fieldErrors,
  signInSchema,
  signUpSchema,
  type FieldErrors,
} from "@/lib/auth/schema";
import { BUTTON_PRIMARY, INPUT } from "@/components/landing/ui";

export type Mode = "sign-up" | "sign-in";

type Values = { name: string; email: string; password: string };

const EMPTY: Values = { name: "", email: "", password: "" };

const COPY = {
  "sign-up": {
    submit: "Buat akun",
    pending: "Membuat akun…",
  },
  "sign-in": {
    submit: "Masuk",
    pending: "Memeriksa…",
  },
} as const;

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const copy = COPY[mode];

  const set = (field: keyof Values) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** Move focus to the first invalid field so the error is announced, not just painted. */
  const focusFirstError = (next: FieldErrors<Values>) => {
    const order: (keyof Values)[] =
      mode === "sign-up" ? ["name", "email", "password"] : ["email", "password"];
    const first = order.find((field) => next[field]);
    if (first) document.getElementById(first)?.focus();
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);

    const payload =
      mode === "sign-up"
        ? { name: values.name, email: values.email, password: values.password }
        : { email: values.email, password: values.password, next };

    const parsed =
      mode === "sign-up"
        ? signUpSchema.safeParse(payload)
        : signInSchema.safeParse(payload);

    if (!parsed.success) {
      const next = fieldErrors<Values>(parsed.error);
      setErrors(next);
      focusFirstError(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ...parsed.data }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        // The server's message is the message. Never replaced by a toast or a success.
        const next = (body?.fieldErrors ?? {}) as FieldErrors<Values>;
        setErrors(next);
        focusFirstError(next);
        setMessage(
          typeof body?.message === "string"
            ? body.message
            : "Permintaan gagal. Coba lagi.",
        );
        return;
      }

      // A 2xx means a session cookie was set upstream; there is no client-side fake here.
      if (typeof body?.redirectTo === "string") router.push(body.redirectTo);
      else router.refresh();
    } catch {
      setMessage(
        "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  const fieldError = (field: keyof Values) => errors[field];

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-6">
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

      {mode === "sign-up" ? (
        <div className="mb-5">
          <label
            htmlFor="name"
            className="block text-small font-bold text-ink"
          >
            Nama lengkap
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(event) => set("name")(event.target.value)}
            aria-invalid={Boolean(fieldError("name"))}
            aria-describedby={fieldError("name") ? "name-error" : undefined}
            className={`${INPUT} mt-2 ${
              fieldError("name") ? "border-danger focus:border-danger" : "border-gold-line focus:border-emerald"
            }`}
          />
          {fieldError("name") ? (
            <p id="name-error" className="mt-1.5 text-small text-danger">
              {fieldError("name")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-5">
        <label htmlFor="email" className="block text-small font-bold text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => set("email")(event.target.value)}
          aria-invalid={Boolean(fieldError("email"))}
          aria-describedby={fieldError("email") ? "email-error" : undefined}
          className={`${INPUT} mt-2 ${
            fieldError("email") ? "border-danger focus:border-danger" : "border-gold-line focus:border-emerald"
          }`}
        />
        {fieldError("email") ? (
          <p id="email-error" className="mt-1.5 text-small text-danger">
            {fieldError("email")}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-small font-bold text-ink"
        >
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          value={values.password}
          onChange={(event) => set("password")(event.target.value)}
          aria-invalid={Boolean(fieldError("password"))}
          aria-describedby={
            mode === "sign-up"
              ? "password-hint password-error"
              : fieldError("password")
                ? "password-error"
                : undefined
          }
          className={`${INPUT} mt-2 ${
            fieldError("password") ? "border-danger focus:border-danger" : "border-gold-line focus:border-emerald"
          }`}
        />
        {mode === "sign-up" ? (
          <p id="password-hint" className="mt-1.5 text-small text-ink-muted">
            Minimal 10 karakter.
          </p>
        ) : null}
        {fieldError("password") ? (
          <p id="password-error" className="mt-1.5 text-small text-danger">
            {fieldError("password")}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} mt-7 w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}
