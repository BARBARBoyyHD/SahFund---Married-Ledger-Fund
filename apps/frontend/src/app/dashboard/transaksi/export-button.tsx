"use client";

import { useState } from "react";

import { BUTTON_SMALL } from "@/components/app/ui";

/**
 * US-38: the CSV export trigger on the ledger. A download is a file, not a page, so a
 * plain link would turn a free workspace's 403 into raw JSON in the tab. Fetch, then
 * either save the blob or paint the server's unlock message verbatim (design D2,
 * AGENTS §8) — never a silent failure.
 */
export function ExportButton({ workspaceId }: { workspaceId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (pending) return;
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/export`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(typeof body?.message === "string" ? body.message : "Ekspor gagal. Coba lagi.");
        return;
      }

      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName(response.headers.get("content-disposition"));
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        aria-busy={pending}
        className={BUTTON_SMALL}
      >
        {pending ? "Menyiapkan ekspor…" : "Ekspor CSV"}
      </button>
      <div aria-live="assertive">
        {message ? (
          <p role="alert" className="max-w-[40ch] text-right text-small font-semibold text-danger">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The server's filename, so the saved file matches Content-Disposition. */
function fileName(header: string | null): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? `sahfund-${new Date().toISOString().slice(0, 10)}.csv`;
}
