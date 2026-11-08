"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { DIALOG_CLASS, DialogHeading } from "@/components/app/dialog";
import { useSignOut } from "@/components/app/use-sign-out";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAccountPanel } from "./delete-account-panel";
import { DetailsForm } from "./details-form";
import { Icon } from "./dashboard-icons";
import { InvitePanel } from "./invite-panel";
import { ManualTransactionForm } from "./manual-transaction-form";

/**
 * US-07/US-08/US-21 inside the dashboard. The panels own their fetch, validation and
 * `router.refresh()`; this file only supplies the triggers and the native `<dialog>`
 * chrome — built-in focus trap, Escape close, backdrop, and focus restored to the
 * trigger on close. No hand-rolled focus management.
 *
 * The five header actions live behind one ellipsis button so the phone header stays a
 * single 40px control instead of a wrapping button wall.
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
  // Remounts the delete panel on each open, so a half-confirmed destructive form never
  // survives a close (the acknowledgements are a deliberate second action).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { signOut, pending, message } = useSignOut();

  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Menu aksi">
            <Icon name="more" className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => manualDialog.current?.showModal()}>
              Tambah manual
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/imports" />}>
              Impor mutasi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => inviteDialog.current?.showModal()}>
              Undang pasangan
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSettingsOpen(true);
                settingsDialog.current?.showModal();
              }}
            >
              Pengaturan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} disabled={pending}>
              {pending ? "Keluar…" : "Keluar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {message ? (
          <p role="alert" className="text-small font-semibold text-danger">
            {message}
          </p>
        ) : null}
      </div>

      <dialog
        ref={manualDialog}
        aria-labelledby="transaksi-baru-judul"
        className={DIALOG_CLASS}
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
        className={DIALOG_CLASS}
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
        className={DIALOG_CLASS}
        onClick={closeOnBackdrop}
        onClose={() => setSettingsOpen(false)}
      >
        <DialogHeading
          id="pengaturan-judul"
          title="Pengaturan"
          description="Tanggal pernikahan, target anggaran, dan penghapusan akun."
          onClose={() => settingsDialog.current?.close()}
        />
        <div className="mt-5">
          <DetailsForm
            workspaceId={workspaceId}
            initialWeddingDate={initialWeddingDate}
            initialBudget={initialBudget}
          />
          {settingsOpen ? <DeleteAccountPanel /> : null}
        </div>
      </dialog>
    </>
  );
}
