"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import { createWorkspaceSchema, type CreateWorkspaceFormValues } from "@/lib/workspace/schema";

const EMPTY: CreateWorkspaceFormValues = { name: "", weddingDate: "", budgetTarget: "" };

type ResponseBody = {
  id?: string;
  message?: string;
  fieldErrors?: FieldErrors<CreateWorkspaceFormValues>;
};

/**
 * US-05 form leaf. Validates with the *same* schema the handler uses, then posts the
 * raw values: `budgetTarget` is rupiah text, and the server turns it into integer
 * minor units (NFR-03). The server's message — including the 409 "already belongs"
 * refusal — is rendered verbatim (AGENTS §6/§7).
 */
export function CreateWorkspaceForm() {
  const router = useRouter();
  const [values, setValues] = useState<CreateWorkspaceFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<CreateWorkspaceFormValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (field: keyof CreateWorkspaceFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const focusFirstError = (next: FieldErrors<CreateWorkspaceFormValues>) => {
    const order: (keyof CreateWorkspaceFormValues)[] = ["name", "weddingDate", "budgetTarget"];
    const first = order.find((field) => next[field]);
    if (first) document.getElementById(first)?.focus();
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);

    const parsed = createWorkspaceSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<CreateWorkspaceFormValues>(parsed.error);
      setErrors(next);
      focusFirstError(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          weddingDate: values.weddingDate,
          budgetTarget: values.budgetTarget,
        }),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        focusFirstError(next);
        setMessage(
          typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.",
        );
        return;
      }

      if (typeof body?.id === "string") router.push(`/w/${body.id}`);
      else router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending}>
      <FormMessage message={message} />

      <Field
        id="name"
        label="Nama workspace"
        hint="Misalnya: Nikah Ayu & Budi"
        error={errors.name}
      >
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="off"
          value={values.name}
          onChange={(event) => set("name")(event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name", { hint: true, error: errors.name })}
          className={inputClass(errors.name)}
        />
      </Field>

      <Field
        id="weddingDate"
        label="Tanggal pernikahan (opsional)"
        hint="Bisa diisi nanti dari dashboard."
        error={errors.weddingDate}
      >
        <input
          id="weddingDate"
          name="weddingDate"
          type="date"
          value={values.weddingDate ?? ""}
          onChange={(event) => set("weddingDate")(event.target.value)}
          aria-invalid={Boolean(errors.weddingDate)}
          aria-describedby={describedBy("weddingDate", { hint: true, error: errors.weddingDate })}
          className={inputClass(errors.weddingDate)}
        />
      </Field>

      <Field
        id="budgetTarget"
        label="Target anggaran (opsional)"
        hint="Tulis angka rupiah, misalnya 50.000.000."
        error={errors.budgetTarget}
      >
        <input
          id="budgetTarget"
          name="budgetTarget"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="50.000.000"
          value={values.budgetTarget ?? ""}
          onChange={(event) => set("budgetTarget")(event.target.value)}
          aria-invalid={Boolean(errors.budgetTarget)}
          aria-describedby={describedBy("budgetTarget", {
            hint: true,
            error: errors.budgetTarget,
          })}
          className={inputClass(errors.budgetTarget)}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} mt-2 w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? "Membuat workspace…" : "Buat workspace"}
      </button>
    </form>
  );
}
