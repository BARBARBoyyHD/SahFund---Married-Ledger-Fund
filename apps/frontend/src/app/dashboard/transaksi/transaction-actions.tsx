"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_SMALL } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { formatDate, formatRupiah } from "@/core/money";
import {
  createManualTransactionSchema,
  updateTransactionClassificationSchema,
  type CreateManualTransactionFormValues,
} from "@/lib/ledger/schema";
import { fieldErrors } from "@/lib/validation";
import { Icon } from "../dashboard-icons";

type Row = {
  id: string;
  occurredOn: string;
  description: string;
  /** Signed minor units (positive = money in). */
  amountMinor: number;
  direction: string;
  categoryId: string | null;
  memberId: string | null;
  imported: boolean;
};

type EditField =
  | "occurredOn"
  | "description"
  | "direction"
  | "amount"
  | "categoryId"
  | "memberId";

type FieldErrorMap = Partial<Record<EditField, string>>;

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrorMap;
};

const DIALOG_ACTION =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-small font-bold transition-colors disabled:pointer-events-none disabled:opacity-60";
const EDIT_BUTTON = `${DIALOG_ACTION} text-ink-muted hover:bg-emerald-soft hover:text-emerald`;
const DELETE_BUTTON = `${DIALOG_ACTION} border border-danger/30 text-danger hover:bg-danger/5`;

/**
 * Row actions on the ledger (user-directed; DELETE is beyond BRD FR-05). Native
 * `<dialog>`s, like every other dialog in the app: focus trap, Escape and focus return
 * to the trigger are the browser's. The row decides the form — manual rows are fully
 * editable, imported rows only category/member, because their amount/date are statement
 * facts (US-20).
 */
export function TransactionActions({
  workspaceId,
  transaction,
  categories,
  members,
}: {
  workspaceId: string;
  transaction: Row;
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const [values, setValues] = useState<CreateManualTransactionFormValues>(() =>
    initialValues(transaction),
  );
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fieldId = (field: EditField) => `edit-${transaction.id}-${field}`;

  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  function openEdit() {
    // Re-sync from the (possibly refreshed) row before every open.
    setValues(initialValues(transaction));
    setErrors({});
    setMessage(null);
    editDialog.current?.showModal();
  }

  function openDelete() {
    setDeleteMessage(null);
    deleteDialog.current?.showModal();
  }

  function focusFirstInvalid(next: FieldErrorMap) {
    const first = (Object.keys(next) as EditField[]).find((field) => next[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage(null);

    const parsed = transaction.imported
      ? updateTransactionClassificationSchema.safeParse({
          categoryId: values.categoryId,
          memberId: values.memberId,
        })
      : createManualTransactionSchema.safeParse(values);

    if (!parsed.success) {
      const next = fieldErrors<FieldErrorMap>(parsed.error);
      setErrors(next);
      focusFirstInvalid(next);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/transactions/${transaction.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            transaction.imported
              ? { categoryId: values.categoryId, memberId: values.memberId }
              : values,
          ),
        },
      );
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setMessage(
          typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.",
        );
        focusFirstInvalid(next);
        return;
      }

      editDialog.current?.close();
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (deleting) return;
    setDeleteMessage(null);
    setDeleting(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ResponseBody | null;
        setDeleteMessage(
          typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.",
        );
        return;
      }

      deleteDialog.current?.close();
      router.refresh();
    } catch {
      setDeleteMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  function set(field: EditField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Ubah transaksi ${transaction.description}`}
        className={EDIT_BUTTON}
        onClick={openEdit}
      >
        <Icon name="edit" className="h-4 w-4" />
        Ubah
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Hapus transaksi ${transaction.description}`}
        className={DELETE_BUTTON}
        onClick={openDelete}
      >
        <Icon name="trash" className="h-4 w-4" />
        Hapus
      </button>

      <dialog
        ref={editDialog}
        aria-labelledby={`edit-${transaction.id}-judul`}
        className={DIALOG_CLASS}
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id={`edit-${transaction.id}-judul`}
          title="Ubah transaksi"
          description={
            transaction.imported
              ? "Transaksi impor: hanya kategori dan anggota yang bisa diubah. Tanggal dan nominal adalah fakta mutasi bank."
              : "Perbarui tanggal, deskripsi, nominal, kategori, atau anggotanya."
          }
          onClose={() => editDialog.current?.close()}
        />

        <form onSubmit={onSave} noValidate aria-busy={pending} className="mt-5">
          <FormMessage message={message} />

          {transaction.imported ? null : (
            <>
              <Field id={fieldId("occurredOn")} label="Tanggal" error={errors.occurredOn}>
                <input
                  id={fieldId("occurredOn")}
                  name="occurredOn"
                  type="date"
                  value={values.occurredOn}
                  onChange={(event) => set("occurredOn", event.target.value)}
                  aria-invalid={Boolean(errors.occurredOn)}
                  aria-describedby={describedBy(fieldId("occurredOn"), {
                    error: errors.occurredOn,
                  })}
                  className={inputClass(errors.occurredOn)}
                />
              </Field>

              <Field id={fieldId("description")} label="Deskripsi" error={errors.description}>
                <input
                  id={fieldId("description")}
                  name="description"
                  type="text"
                  autoComplete="off"
                  value={values.description}
                  onChange={(event) => set("description", event.target.value)}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={describedBy(fieldId("description"), {
                    error: errors.description,
                  })}
                  className={inputClass(errors.description)}
                />
              </Field>

              <Field
                id={fieldId("direction")}
                label="Jenis transaksi"
                hint="Uang masuk menambah saldo; uang keluar mengurangi."
                error={errors.direction}
              >
                <select
                  id={fieldId("direction")}
                  name="direction"
                  value={values.direction}
                  onChange={(event) =>
                    set("direction", event.target.value as "in" | "out")
                  }
                  aria-invalid={Boolean(errors.direction)}
                  aria-describedby={describedBy(fieldId("direction"), {
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
                id={fieldId("amount")}
                label="Nominal"
                hint="Tulis angka rupiah tanpa tanda minus, misalnya 250.000."
                error={errors.amount}
              >
                <input
                  id={fieldId("amount")}
                  name="amount"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.amount}
                  onChange={(event) => set("amount", event.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describedBy(fieldId("amount"), {
                    hint: true,
                    error: errors.amount,
                  })}
                  className={inputClass(errors.amount)}
                />
              </Field>
            </>
          )}

          <Field id={fieldId("categoryId")} label="Kategori" error={errors.categoryId}>
            <select
              id={fieldId("categoryId")}
              name="categoryId"
              value={values.categoryId ?? ""}
              onChange={(event) => set("categoryId", event.target.value)}
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={describedBy(fieldId("categoryId"), {
                error: errors.categoryId,
              })}
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

          <Field id={fieldId("memberId")} label="Anggota" error={errors.memberId}>
            <select
              id={fieldId("memberId")}
              name="memberId"
              value={values.memberId ?? ""}
              onChange={(event) => set("memberId", event.target.value)}
              aria-invalid={Boolean(errors.memberId)}
              aria-describedby={describedBy(fieldId("memberId"), {
                error: errors.memberId,
              })}
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
            {pending ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </form>
      </dialog>

      <dialog
        ref={deleteDialog}
        aria-labelledby={`delete-${transaction.id}-judul`}
        className={DIALOG_CLASS}
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id={`delete-${transaction.id}-judul`}
          title="Hapus transaksi?"
          description={`${formatDate(transaction.occurredOn)} · ${transaction.description} · ${formatRupiah(transaction.amountMinor)}`}
          onClose={() => deleteDialog.current?.close()}
        />
        <p className="mt-4 text-small text-ink-muted">
          Transaksi yang dihapus tidak bisa dikembalikan. Saldo dan laporan ikut berubah.
        </p>
        <FormMessage message={deleteMessage} />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={BUTTON_SMALL}
            onClick={() => deleteDialog.current?.close()}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center rounded-sm bg-danger px-4 text-small font-bold text-surface transition-colors hover:bg-danger/90 disabled:pointer-events-none disabled:opacity-60"
          >
            {deleting ? "Menghapus…" : "Hapus transaksi"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function initialValues(transaction: Row): CreateManualTransactionFormValues {
  return {
    occurredOn: transaction.occurredOn,
    description: transaction.description,
    direction: transaction.direction === "in" ? "in" : "out",
    amount: formatRupiah(Math.abs(transaction.amountMinor)),
    categoryId: transaction.categoryId ?? "",
    memberId: transaction.memberId ?? "",
  };
}
