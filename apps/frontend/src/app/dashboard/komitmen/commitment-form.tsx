"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { createCommitmentSchema, type CreateCommitmentFormValues } from "@/lib/commitments/schema";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrors<CreateCommitmentFormValues>;
};

const FIELD_ID: Record<keyof CreateCommitmentFormValues, string> = {
  vendor: "vendor-komitmen",
  categoryId: "kategori-komitmen",
  total: "total-komitmen",
  paid: "terbayar-komitmen",
  dueOn: "tempo-komitmen",
};

function focusFirstInvalid(errors: FieldErrors<CreateCommitmentFormValues>) {
  const first = (Object.keys(FIELD_ID) as (keyof typeof FIELD_ID)[]).find(
    (field) => errors[field],
  );
  if (first) document.getElementById(FIELD_ID[first])?.focus();
}

const EMPTY: CreateCommitmentFormValues = {
  vendor: "",
  categoryId: "",
  total: "",
  paid: "",
  dueOn: "",
};

/**
 * US-28: vendor contract with total, DP paid and an optional due date. Validates with
 * the same schema the handler runs, then refreshes the server component so the list and
 * the dashboard's "Komitmen mendatang" both re-read D1.
 */
export function CommitmentForm({
  workspaceId,
  categories,
  onSaved,
}: {
  workspaceId: string;
  categories: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CreateCommitmentFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<CreateCommitmentFormValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof CreateCommitmentFormValues>(
    field: K,
    value: CreateCommitmentFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);

    const parsed = createCommitmentSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<CreateCommitmentFormValues>(parsed.error);
      setErrors(next);
      focusFirstInvalid(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/commitments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setMessage(typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.");
        focusFirstInvalid(next);
        return;
      }

      setValues(EMPTY);
      router.refresh();
      onSaved();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending}>
      <FormMessage message={message} />

      <Field id="vendor-komitmen" label="Vendor" error={errors.vendor}>
        <input
          id="vendor-komitmen"
          name="vendor"
          type="text"
          autoComplete="off"
          placeholder="Misalnya: Nirmala Décor"
          value={values.vendor}
          onChange={(event) => set("vendor", event.target.value)}
          aria-invalid={Boolean(errors.vendor)}
          aria-describedby={describedBy("vendor-komitmen", { error: errors.vendor })}
          className={inputClass(errors.vendor)}
        />
      </Field>

      <Field id="kategori-komitmen" label="Kategori" error={errors.categoryId}>
        <select
          id="kategori-komitmen"
          name="categoryId"
          value={values.categoryId ?? ""}
          onChange={(event) => set("categoryId", event.target.value)}
          aria-invalid={Boolean(errors.categoryId)}
          aria-describedby={describedBy("kategori-komitmen", { error: errors.categoryId })}
          className={inputClass(errors.categoryId)}
        >
          <option value="">Tanpa kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="total-komitmen"
        label="Total kontrak"
        hint="Tulis angka rupiah, misalnya 30.000.000."
        error={errors.total}
      >
        <input
          id="total-komitmen"
          name="total"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="30.000.000"
          value={values.total}
          onChange={(event) => set("total", event.target.value)}
          aria-invalid={Boolean(errors.total)}
          aria-describedby={describedBy("total-komitmen", { hint: true, error: errors.total })}
          className={inputClass(errors.total)}
        />
      </Field>

      <Field
        id="terbayar-komitmen"
        label="Sudah dibayar"
        hint="DP atau pelunasan yang sudah dibayar. Kosongkan kalau belum ada."
        error={errors.paid}
      >
        <input
          id="terbayar-komitmen"
          name="paid"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={values.paid ?? ""}
          onChange={(event) => set("paid", event.target.value)}
          aria-invalid={Boolean(errors.paid)}
          aria-describedby={describedBy("terbayar-komitmen", { hint: true, error: errors.paid })}
          className={inputClass(errors.paid)}
        />
      </Field>

      <Field
        id="tempo-komitmen"
        label="Jatuh tempo (opsional)"
        hint="Kosongkan kalau tanggalnya belum ditentukan."
        error={errors.dueOn}
      >
        <input
          id="tempo-komitmen"
          name="dueOn"
          type="date"
          value={values.dueOn ?? ""}
          onChange={(event) => set("dueOn", event.target.value)}
          aria-invalid={Boolean(errors.dueOn)}
          aria-describedby={describedBy("tempo-komitmen", { hint: true, error: errors.dueOn })}
          className={inputClass(errors.dueOn)}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? "Menyimpan…" : "Simpan komitmen"}
      </button>
    </form>
  );
}
