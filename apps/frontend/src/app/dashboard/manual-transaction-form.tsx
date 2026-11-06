"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import {
  createManualTransactionSchema,
  type CreateManualTransactionFormValues,
} from "@/lib/ledger/schema";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrors<CreateManualTransactionFormValues>;
};

/** Schema keys → the ids the inputs render, so a 422 moves focus like the client check. */
const FIELD_ID: Record<keyof CreateManualTransactionFormValues, string> = {
  occurredOn: "tanggal-transaksi",
  description: "deskripsi-transaksi",
  direction: "jenis-transaksi",
  amount: "nominal-transaksi",
  categoryId: "kategori-transaksi",
  memberId: "anggota-transaksi",
};

function focusFirstInvalid(errors: FieldErrors<CreateManualTransactionFormValues>) {
  const first = (Object.keys(FIELD_ID) as (keyof typeof FIELD_ID)[]).find(
    (field) => errors[field],
  );
  if (first) document.getElementById(FIELD_ID[first])?.focus();
}

function initialValues(today: string): CreateManualTransactionFormValues {
  return {
    occurredOn: today,
    description: "",
    direction: "out",
    amount: "",
    categoryId: "",
    memberId: "",
  };
}

/**
 * US-21: manual cash / other-bank entry. The direction select makes the sign explicit —
 * "Uang keluar" stores a negative `amountMinor`, "Uang masuk" a positive one — so the
 * user never types a minus sign. Validates with the same schema the handler runs, then
 * refreshes the server component so the hero, cards and feed re-read D1.
 */
export function ManualTransactionForm({
  workspaceId,
  today,
  categories,
  members,
  onSaved,
}: {
  workspaceId: string;
  today: string;
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CreateManualTransactionFormValues>(() =>
    initialValues(today),
  );
  const [errors, setErrors] = useState<FieldErrors<CreateManualTransactionFormValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof CreateManualTransactionFormValues>(
    field: K,
    value: CreateManualTransactionFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);

    const parsed = createManualTransactionSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<CreateManualTransactionFormValues>(parsed.error);
      setErrors(next);
      focusFirstInvalid(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        // 409 duplicate, 422 reference/field, 503 — the server's message is the message.
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setMessage(typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.");
        focusFirstInvalid(next);
        return;
      }

      setValues(initialValues(today));
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

      <Field id="tanggal-transaksi" label="Tanggal" error={errors.occurredOn}>
        <input
          id="tanggal-transaksi"
          name="occurredOn"
          type="date"
          value={values.occurredOn}
          onChange={(event) => set("occurredOn", event.target.value)}
          aria-invalid={Boolean(errors.occurredOn)}
          aria-describedby={describedBy("tanggal-transaksi", { error: errors.occurredOn })}
          className={inputClass(errors.occurredOn)}
        />
      </Field>

      <Field id="deskripsi-transaksi" label="Deskripsi" error={errors.description}>
        <input
          id="deskripsi-transaksi"
          name="description"
          type="text"
          autoComplete="off"
          placeholder="Misalnya: DP dekorasi dibayar tunai"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy("deskripsi-transaksi", { error: errors.description })}
          className={inputClass(errors.description)}
        />
      </Field>

      <Field
        id="jenis-transaksi"
        label="Jenis transaksi"
        hint="Uang masuk menambah saldo; uang keluar mengurangi."
        error={errors.direction}
      >
        <select
          id="jenis-transaksi"
          name="direction"
          value={values.direction}
          onChange={(event) => set("direction", event.target.value as "in" | "out")}
          aria-invalid={Boolean(errors.direction)}
          aria-describedby={describedBy("jenis-transaksi", {
            hint: true,
            error: errors.direction,
          })}
          className={inputClass(errors.direction)}
        >
          <option value="out">Uang keluar</option>
          <option value="in">Uang masuk</option>
        </select>
      </Field>

      <Field
        id="nominal-transaksi"
        label="Nominal"
        hint="Tulis angka rupiah tanpa tanda minus, misalnya 250.000."
        error={errors.amount}
      >
        <input
          id="nominal-transaksi"
          name="amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="250.000"
          value={values.amount}
          onChange={(event) => set("amount", event.target.value)}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy("nominal-transaksi", {
            hint: true,
            error: errors.amount,
          })}
          className={inputClass(errors.amount)}
        />
      </Field>

      <Field id="kategori-transaksi" label="Kategori" error={errors.categoryId}>
        <select
          id="kategori-transaksi"
          name="categoryId"
          value={values.categoryId ?? ""}
          onChange={(event) => set("categoryId", event.target.value)}
          aria-invalid={Boolean(errors.categoryId)}
          aria-describedby={describedBy("kategori-transaksi", { error: errors.categoryId })}
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

      <Field id="anggota-transaksi" label="Anggota" error={errors.memberId}>
        <select
          id="anggota-transaksi"
          name="memberId"
          value={values.memberId ?? ""}
          onChange={(event) => set("memberId", event.target.value)}
          aria-invalid={Boolean(errors.memberId)}
          aria-describedby={describedBy("anggota-transaksi", { error: errors.memberId })}
          className={inputClass(errors.memberId)}
        >
          <option value="">Tanpa anggota</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
      >
        {pending ? "Menyimpan…" : "Simpan transaksi"}
      </button>
    </form>
  );
}
