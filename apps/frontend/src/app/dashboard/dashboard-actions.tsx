"use client";

import { useRef } from "react";

import { BUTTON_SMALL } from "@/components/app/ui";
import { DetailsForm } from "./details-form";
import { Icon } from "./icons";
import { InvitePanel } from "./invite-panel";
import { ManualTransactionForm } from "./manual-transaction-form";

/**
 * US-07/US-08/US-21 inside the dashboard. The panels own their fetch, validation and
 * `router.refresh()`; this file only supplies the triggers and the native `<dialog>`
 * chrome — built-in focus trap, Escape close, backdrop, and focus restored to the
 * trigger on close. No hand-rolled focus management.
 */
export function DashboardActions({
  workspaceId,
  inviteCode,
  joinPath,
  isOwner,
  initialWeddingDate,
  initialBudget,
  today,
  categories,
  members,
}: {
  workspaceId: string;
  inviteCode: string;
  joinPath: string;
  isOwner: boolean;
  initialWeddingDate: string;
  initialBudget: string;
  today: string;
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const manualDialog = useRef<HTMLDialogElement>(null);
  const inviteDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);

  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={`${BUTTON_SMALL} gap-1.5`}
        onClick={() => manualDialog.current?.showModal()}
      >
        <Icon name="plus" className="h-4 w-4" />
        Tambah manual
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        className={BUTTON_SMALL}
        onClick={() => inviteDialog.current?.showModal()}
      >
        Undang pasangan
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        className={BUTTON_SMALL}
        onClick={() => settingsDialog.current?.showModal()}
      >
        Pengaturan
      </button>

      <dialog
        ref={manualDialog}
        aria-labelledby="transaksi-baru-judul"
        className="modal w-[min(92vw,34rem)] max-h-[85svh] overflow-y-auto rounded-md border border-gold/60 bg-surface p-6 text-ink shadow-card"
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id="transaksi-baru-judul"
          title="Tambah transaksi manual"
          description="Catat pembayaran tunai atau dari rekening lain. Tanpa impor."
          onClose={() => manualDialog.current?.close()}
        />
        <div className="mt-5">
          <ManualTransactionForm
            workspaceId={workspaceId}
            today={today}
            categories={categories}
            members={members}
            onSaved={() => manualDialog.current?.close()}
          />
        </div>
      </dialog>

      <dialog
        ref={inviteDialog}
        aria-labelledby="undangan-judul"
        className="modal w-[min(92vw,34rem)] max-h-[85svh] overflow-y-auto rounded-md border border-gold/60 bg-surface p-6 text-ink shadow-card"
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id="undangan-judul"
          title="Undang pasangan"
          description={
            isOwner
              ? "Bagikan kode atau tautan ini, atau kirim undangan lewat email."
              : "Kode dan tautan workspace kalian."
          }
          onClose={() => inviteDialog.current?.close()}
        />
        <div className="mt-5">
          <InvitePanel
            workspaceId={workspaceId}
            inviteCode={inviteCode}
            joinPath={joinPath}
            isOwner={isOwner}
          />
        </div>
      </dialog>

      <dialog
        ref={settingsDialog}
        aria-labelledby="pengaturan-judul"
        className="modal w-[min(92vw,34rem)] max-h-[85svh] overflow-y-auto rounded-md border border-gold/60 bg-surface p-6 text-ink shadow-card"
        onClick={closeOnBackdrop}
      >
        <DialogHeading
          id="pengaturan-judul"
          title="Pengaturan"
          description="Tanggal pernikahan dan target anggaran bisa diubah kapan saja."
          onClose={() => settingsDialog.current?.close()}
        />
        <div className="mt-5">
          <DetailsForm
            workspaceId={workspaceId}
            initialWeddingDate={initialWeddingDate}
            initialBudget={initialBudget}
          />
        </div>
      </dialog>
    </>
  );
}

function DialogHeading({
  id,
  title,
  description,
  onClose,
}: {
  id: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-h3 font-bold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-small text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-emerald-soft hover:text-emerald"
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
    </div>
  );
}
