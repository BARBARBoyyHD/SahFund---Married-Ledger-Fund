"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_SMALL } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { formatRupiah } from "@/core/money";
import { updateCategorySchema, type UpdateCategoryFormValues } from "@/lib/categories/schema";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import { Icon } from "../dashboard-icons";

type ResponseBody = {
  message?: string;
  fieldErrors?: FieldErrors<UpdateCategoryFormValues>;
};

/**
 * US-26: set one category's budget from the report row it affects. The rupiah text is
 * validated by the same schema the handler runs (AGENTS §7), and empty means "clear the
 * budget" — stored NULL, never a fake zero. A native `<dialog>` like every other dialog
 * here: focus trap, Escape and focus return are the browser's.
 */
export function BudgetAction({
  workspaceId,
  categoryId,
  categoryName,
  budgetMinor,
}: {
  workspaceId: string;
  categoryId: string;
  categoryName: string;
  budgetMinor: number | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const inputId = `anggaran-${categoryId}`;

  const [value, setValue] = useState(() => initialText(budgetMinor));
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function open() {
    // Re-sync from the (possibly refreshed) row before every open.
    setValue(initialText(budgetMinor));
    setError(undefined);
    setMessage(null);
    dialog.current?.showModal();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage(null);

    const parsed = updateCategorySchema.safeParse({ budget: value });
    if (!parsed.success) {
      setError(fieldErrors<UpdateCategoryFormValues>(parsed.error).budget);
      document.getElementById(inputId)?.focus();
      return;
    }

    setError(undefined);
    setPending(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/categories/${categoryId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ budget: value }),
        },
      );
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setError(body?.fieldErrors?.budget);
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
        aria-label={`Atur anggaran ${categoryName}`}
        className={BUTTON_SMALL}
        onClick={open}
      >
        <Icon name="edit" className="h-4 w-4" />
        Ubah
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${inputId}-judul`}
        className={DIALOG_CLASS}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <DialogHeading
          id={`${inputId}-judul`}
          title={`Anggaran ${categoryName}`}
          description="Anggaran kategori ini menjadi pembanding realisasi di laporan. Kosongkan untuk menghapus anggarannya."
          onClose={() => dialog.current?.close()}
        />

        <form onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-5">
          <FormMessage message={message} />

          <Field
            id={inputId}
            label="Anggaran"
            hint="Tulis angka rupiah, misalnya 12.000.000."
            error={error}
          >
            <input
              id={inputId}
              name="budget"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="12.000.000"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(undefined);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy(inputId, { hint: true, error })}
              className={inputClass(error)}
            />
          </Field>

          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
          >
            {pending ? "Menyimpan…" : "Simpan anggaran"}
          </button>
        </form>
      </dialog>
    </>
  );
}

/** An existing budget is shown as the user reads it; the parser accepts `Rp` and dots. */
function initialText(budgetMinor: number | null): string {
  return budgetMinor === null ? "" : formatRupiah(budgetMinor);
}
