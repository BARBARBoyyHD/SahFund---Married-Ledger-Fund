"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage } from "@/components/app/form";
import { BUTTON_SMALL } from "@/components/app/ui";

/**
 * US-17: confirming a flagged import is explicit — one click, one flag, then the server
 * re-reads totals. The row stays visibly "belum cocok" afterwards; the button is only
 * rendered while unconfirmed, and the handler re-checks the same condition server-side.
 */
export function ConfirmImportButton({
  workspaceId,
  importId,
}: {
  workspaceId: string;
  importId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/imports/${importId}/confirm`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        // 404 (nothing left to confirm) / 503 — shown verbatim, and the button stays live.
        setMessage(typeof body?.message === "string" ? body.message : "Konfirmasi gagal. Coba lagi.");
        return;
      }

      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={confirm} disabled={pending} className={BUTTON_SMALL}>
        {pending ? "Mengonfirmasi…" : "Konfirmasi & masukkan ke total"}
      </button>
      <FormMessage message={message} />
    </div>
  );
}
