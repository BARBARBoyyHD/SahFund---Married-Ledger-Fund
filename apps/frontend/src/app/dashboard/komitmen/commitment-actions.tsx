"use client";

import { useRef } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { BUTTON_SMALL } from "@/components/app/ui";
import { CommitmentForm } from "./commitment-form";
import { Icon } from "../dashboard-icons";

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
