"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { LINK } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import { joinWorkspaceSchema } from "@/lib/workspace/schema";

type Values = { code: string };

type ResponseBody = {
  workspaceId?: string;
  message?: string;
  fieldErrors?: FieldErrors<Values>;
};

/**
 * US-06 / US-53. The format is rejected inline by the shared schema *before* the POST,
 * so a malformed code never reaches a lookup (the handler repeats that check). Every
 * failure the server answers — invalid, full, already here, already elsewhere, expired
 * session — is shown verbatim; the button stays live as its own retry.
 */
export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ code: initialCode });
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);

  function setCode(value: string) {
    setValues({ code: value });
    setErrors({});
    setExpired(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);
    setExpired(false);

    const parsed = joinWorkspaceSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<Values>(parsed.error);
      setErrors(next);
      document.getElementById("code")?.focus();
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: parsed.data.code }),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setExpired(response.status === 401);
        setMessage(typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.");
        if (next.code) document.getElementById("code")?.focus();
        return;
      }

      if (typeof body?.workspaceId === "string") router.push("/dashboard");
      else router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const signInHref = `/login?mode=masuk&next=${encodeURIComponent(
    values.code ? `/join?code=${encodeURIComponent(values.code)}` : "/join",
  )}`;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending}>
      <FormMessage message={message} />
      {expired ? (
        <p className="mb-5 text-small text-ink-muted">
          <Link href={signInHref} className={LINK}>
            Masuk lagi dengan akunmu
          </Link>{" "}
          lalu konfirmasi kodenya.
        </p>
      ) : null}

      <Field
        id="code"
        label="Kode undangan"
        hint="10 karakter: 4 angka, 3 huruf, lalu 3 huruf atau angka. Contoh: 4821kPz7xQ."
        error={errors.code}
      >
        <input
          id="code"
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={10}
          value={values.code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={Boolean(errors.code)}
          aria-describedby={describedBy("code", { hint: true, error: errors.code })}
          className={`${inputClass(errors.code)} font-mono tracking-[0.12em]`}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? "Bergabung…" : "Gabung ke workspace"}
      </button>
    </form>
  );
}
