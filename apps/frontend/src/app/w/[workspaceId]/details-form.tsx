"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import {
  updateWorkspaceDetailsSchema,
  type UpdateWorkspaceDetailsFormValues,
} from "@/lib/workspace/schema";

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrors<UpdateWorkspaceDetailsFormValues>;
};

/**
 * Schema keys → the ids the inputs actually render. The two differ on purpose (Bahasa
 * ids), and looking up the schema key would miss — or hit the kept-alive create-form
 * input of the same name — leaving focus on the submit button (AGENTS §6).
 */
const FIELD_ID: Record<keyof UpdateWorkspaceDetailsFormValues, string> = {
  weddingDate: "tanggal-pernikahan",
  budgetTarget: "target-anggaran",
};

function focusFirstInvalid(errors: FieldErrors<UpdateWorkspaceDetailsFormValues>) {
  const first = (Object.keys(FIELD_ID) as (keyof typeof FIELD_ID)[]).find(
    (field) => errors[field],
  );
  if (first) document.getElementById(FIELD_ID[first])?.focus();
}

/**
 * US-08: any member sets or changes the wedding date and the budget target. Validates
 * with the shared schema, posts the raw values (rupiah text; `""` clears), and asks the
 * server component to re-read the row afterwards — no hand-rolled client cache.
 */
export function DetailsForm({
  workspaceId,
  initialWeddingDate,
  initialBudget,
}: {
  workspaceId: string;
  initialWeddingDate: string;
  initialBudget: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<UpdateWorkspaceDetailsFormValues>({
    weddingDate: initialWeddingDate,
    budgetTarget: initialBudget,
  });
  const [errors, setErrors] = useState<FieldErrors<UpdateWorkspaceDetailsFormValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (field: keyof UpdateWorkspaceDetailsFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaved(false);
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setSaved(false);

    const parsed = updateWorkspaceDetailsSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<UpdateWorkspaceDetailsFormValues>(parsed.error);
      setErrors(next);
      focusFirstInvalid(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/details`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weddingDate: values.weddingDate,
          budgetTarget: values.budgetTarget,
        }),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setError(typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.");
        // A 422 marks the same fields the client check does; move focus there too.
        focusFirstInvalid(next);
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending}>
      <FormMessage message={error} />
      <div aria-live="polite">
        {saved ? (
          <p className="mb-5 rounded-sm border border-emerald/20 bg-emerald-soft px-4 py-3 text-small font-semibold text-emerald">
            Perubahan tersimpan.
          </p>
        ) : null}
      </div>

      <Field
        id="tanggal-pernikahan"
        label="Tanggal pernikahan"
        hint="Kosongkan untuk menghapus tanggal."
        error={errors.weddingDate}
      >
        <input
          id="tanggal-pernikahan"
          name="weddingDate"
          type="date"
          value={values.weddingDate ?? ""}
          onChange={(event) => set("weddingDate")(event.target.value)}
          aria-invalid={Boolean(errors.weddingDate)}
          aria-describedby={describedBy("tanggal-pernikahan", {
            hint: true,
            error: errors.weddingDate,
          })}
          className={inputClass(errors.weddingDate)}
        />
      </Field>

      <Field
        id="target-anggaran"
        label="Target anggaran"
        hint="Tulis angka rupiah, misalnya 50.000.000. Kosongkan untuk menghapus target."
        error={errors.budgetTarget}
      >
        <input
          id="target-anggaran"
          name="budgetTarget"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="50.000.000"
          value={values.budgetTarget ?? ""}
          onChange={(event) => set("budgetTarget")(event.target.value)}
          aria-invalid={Boolean(errors.budgetTarget)}
          aria-describedby={describedBy("target-anggaran", {
            hint: true,
            error: errors.budgetTarget,
          })}
          className={inputClass(errors.budgetTarget)}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? "Menyimpan…" : "Simpan perubahan"}
      </button>
    </form>
  );
}
