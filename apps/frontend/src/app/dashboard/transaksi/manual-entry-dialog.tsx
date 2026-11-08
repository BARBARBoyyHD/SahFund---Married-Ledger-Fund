"use client";

import { useRef } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { BUTTON_SMALL } from "@/components/app/ui";
import { Icon } from "../dashboard-icons";
import { ManualTransactionForm } from "../manual-transaction-form";

/**
 * US-21 from the ledger page: the same form the dashboard dialog renders, so the empty
 * state can honestly say "tambah manual". Native `<dialog>` chrome only; the form owns
 * validation, the request and the server refresh.
 */
export function ManualEntryDialog({
  workspaceId,
  today,
  categories,
  members,
}: {
  workspaceId: string;
  today: string;
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={`${BUTTON_SMALL} gap-1.5`}
        onClick={() => dialog.current?.showModal()}
      >
        <Icon name="plus" className="h-4 w-4" />
        Tambah manual
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="transaksi-baru-judul"
        className={DIALOG_CLASS}
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id="transaksi-baru-judul"
          title="Tambah transaksi manual"
          description="Catat pembayaran tunai atau dari rekening lain. Tanpa impor."
          onClose={() => dialog.current?.close()}
        />
        <div className="mt-5">
          <ManualTransactionForm
            workspaceId={workspaceId}
            today={today}
            categories={categories}
            members={members}
            onSaved={() => dialog.current?.close()}
          />
        </div>
      </dialog>
    </>
  );
}
