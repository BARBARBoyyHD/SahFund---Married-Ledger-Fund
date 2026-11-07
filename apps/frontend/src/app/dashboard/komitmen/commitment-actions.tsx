"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_SMALL } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { formatRupiah } from "@/core/money";
import {
  updateCommitmentSchema,
  type UpdateCommitmentFormValues,
} from "@/lib/commitments/commitment-schema";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import { CommitmentForm } from "./commitment-form";
import { Icon } from "../dashboard-icons";

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrors<UpdateCommitmentFormValues>;
};

/** US-28: the add trigger and its native `<dialog>` (focus trap + focus return built in). */
export function CommitmentActions({
  workspaceId,
  categories,
}: {
  workspaceId: string;
  categories: { id: string; name: string }[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={`${BUTTON_SMALL} gap-1.5`}
        onClick={() => dialog.current?.showModal()}
      >
        <Icon name="plus" className="h-4 w-4" />
        Tambah komitmen
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="komitmen-baru-judul"
        className={DIALOG_CLASS}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <DialogHeading
          id="komitmen-baru-judul"
          title="Tambah komitmen"
          description="Catat kontrak vendor, DP yang sudah dibayar, dan jatuh temponya."
          onClose={() => dialog.current?.close()}
        />
        <div className="mt-5">
          <CommitmentForm
            workspaceId={workspaceId}
            categories={categories}
            onSaved={() => dialog.current?.close()}
          />
        </div>
      </dialog>
    </>
  );
}

/**
 * US-28: record a DP or a later pelunasan on one contract. Same shared schema as the
 * route handler, so the number the user sees validated is the number stored; the server
 * derives `status`, and the refreshed list shows it (Belum dibayar / Sebagian / Lunas).
 * Overpaying is allowed and stored unclamped — the list states the excess honestly.
 */
export function CommitmentSettlement({
  workspaceId,
  commitment,
}: {
  workspaceId: string;
  commitment: {
    id: string;
    vendor: string;
    totalMinor: number;
    paidMinor: number;
    dueOn: string | null;
  };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = `bayar-${commitment.id}`;

  const [values, setValues] = useState<UpdateCommitmentFormValues>(() =>
    initialValues(commitment),
  );
  const [errors, setErrors] = useState<FieldErrors<UpdateCommitmentFormValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function open() {
    // Re-sync from the refreshed row before every open.
    setValues(initialValues(commitment));
    setErrors({});
    setMessage(null);
    dialog.current?.showModal();
  }

  function set(field: keyof UpdateCommitmentFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage(null);

    const parsed = updateCommitmentSchema.safeParse(values);
    if (!parsed.success) {
      const next = fieldErrors<UpdateCommitmentFormValues>(parsed.error);
      setErrors(next);
      const first = (Object.keys(next) as (keyof typeof next)[]).find((field) => next[field]);
      if (first) document.getElementById(`${prefix}-${first}`)?.focus();
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/commitments/${commitment.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            total: values.total,
            paid: values.paid ?? "",
            dueOn: values.dueOn ?? "",
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setErrors(body?.fieldErrors ?? {});
        setMessage(
          typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.",
        );
        return;
      }

      dialog.current?.close();
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Catat pembayaran komitmen ${commitment.vendor}`}
        className={BUTTON_SMALL}
        onClick={open}
      >
        <Icon name="wallet" className="h-4 w-4" />
        Catat pembayaran
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${prefix}-judul`}
        className={DIALOG_CLASS}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <DialogHeading
          id={`${prefix}-judul`}
          title={`Pembayaran ${commitment.vendor}`}
          description="Catat DP atau pelunasan. Status (Belum dibayar / Sebagian / Lunas) dihitung server dari total dan terbayar."
          onClose={() => dialog.current?.close()}
        />

        <form onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-5">
          <FormMessage message={message} />

          <Field id={`${prefix}-total`} label="Total kontrak" error={errors.total}>
            <input
              id={`${prefix}-total`}
              name="total"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.total}
              onChange={(event) => set("total", event.target.value)}
              aria-invalid={Boolean(errors.total)}
              aria-describedby={describedBy(`${prefix}-total`, { error: errors.total })}
              className={inputClass(errors.total)}
            />
          </Field>

          <Field
            id={`${prefix}-paid`}
            label="Sudah dibayar (DP + pelunasan)"
            hint="Isi jumlah total yang sudah dibayar setelah pembayaran ini, bukan hanya nominal yang baru. Boleh melebihi total; laporan menampilkan lebihnya apa adanya."
            error={errors.paid}
          >
            <input
              id={`${prefix}-paid`}
              name="paid"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={values.paid ?? ""}
              onChange={(event) => set("paid", event.target.value)}
              aria-invalid={Boolean(errors.paid)}
              aria-describedby={describedBy(`${prefix}-paid`, {
                hint: true,
                error: errors.paid,
              })}
              className={inputClass(errors.paid)}
            />
          </Field>

          <Field
            id={`${prefix}-dueOn`}
            label="Jatuh tempo (opsional)"
            hint="Kosongkan kalau tanggalnya belum ditentukan."
            error={errors.dueOn}
          >
            <input
              id={`${prefix}-dueOn`}
              name="dueOn"
              type="date"
              value={values.dueOn ?? ""}
              onChange={(event) => set("dueOn", event.target.value)}
              aria-invalid={Boolean(errors.dueOn)}
              aria-describedby={describedBy(`${prefix}-dueOn`, {
                hint: true,
                error: errors.dueOn,
              })}
              className={inputClass(errors.dueOn)}
            />
          </Field>

          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
          >
            {pending ? "Menyimpan…" : "Simpan pembayaran"}
          </button>
        </form>
      </dialog>
    </>
  );
}

function initialValues(commitment: {
  totalMinor: number;
  paidMinor: number;
  dueOn: string | null;
}): UpdateCommitmentFormValues {
  return {
    total: formatRupiah(commitment.totalMinor),
    paid: commitment.paidMinor === 0 ? "" : formatRupiah(commitment.paidMinor),
    dueOn: commitment.dueOn ?? "",
  };
}
