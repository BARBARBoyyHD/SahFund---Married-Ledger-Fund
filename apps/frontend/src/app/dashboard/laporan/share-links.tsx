"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyButton } from "@/components/app/copy-button";
import { FormMessage } from "@/components/app/form";
import { BUTTON_SMALL } from "@/components/app/ui";

/**
 * US-32/34: the owner's share-link list plus create/revoke. The list is read on the
 * server (no `useEffect` fetching); this leaf only performs the two mutations and then
 * `router.refresh()` so the server re-reads the list. Copy and revoke are the only
 * interactive parts of the section.
 */

export type ShareLinkRow = {
  id: string;
  /** Site-relative `/r/:token`; the copy button turns it into an absolute link. */
  url: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
};

const STATUS_LABEL = { active: "Aktif", expired: "Kedaluwarsa", revoked: "Dicabut" } as const;

const STATUS_CLASS = {
  active: "bg-emerald-soft text-emerald",
  expired: "bg-gold/25 text-ink",
  revoked: "bg-danger/10 text-danger",
} as const;

const BUTTON_DANGER =
  "inline-flex h-10 items-center justify-center rounded-sm bg-danger px-4 text-small font-bold text-surface transition-colors duration-150 hover:bg-danger/90 disabled:pointer-events-none disabled:opacity-60";

type ResponseBody = { message?: string; url?: string };

export function ShareLinks({
  workspaceId,
  tokens,
}: {
  workspaceId: string;
  tokens: ShareLinkRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    if (creating) return;
    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/share-tokens`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;
      const url = body?.url;

      if (!response.ok || typeof url !== "string") {
        setMessage(
          typeof body?.message === "string" ? body.message : "Tautan gagal dibuat. Coba lagi.",
        );
        return;
      }

      setCreatedUrl(new URL(url, window.location.origin).toString());
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (revoking !== null) return;
    setRevoking(id);
    setMessage(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/share-tokens/${id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setMessage(
          typeof body?.message === "string" ? body.message : "Tautan gagal dicabut. Coba lagi.",
        );
        return;
      }

      setConfirmId(null);
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={() => void create()} disabled={creating} className={BUTTON_SMALL}>
        {creating ? "Membuat tautan…" : "Buat tautan baru"}
      </button>

      <div aria-live="polite">
        {createdUrl ? (
          <div className="card-sheen mt-4 rounded-sm border border-gold/35 p-4">
            <p className="text-small font-semibold text-ink">Tautan baru siap dibagikan.</p>
            <p className="mt-1 break-all font-mono text-small text-ink">{createdUrl}</p>
            <div className="mt-3">
              <CopyButton value={createdUrl} label="Salin tautan" />
            </div>
          </div>
        ) : null}
      </div>

      <FormMessage message={message} />

      {tokens.length === 0 ? (
        <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
          <p className="text-small font-semibold text-ink">Belum ada tautan laporan.</p>
          <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
            Buat tautan untuk membagikan ringkasan angka — total, anggaran per kategori, dan
            forecast. Penerima tidak perlu punya akun, dan rincian transaksi tidak ikut
            dibagikan.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-rule border-t border-rule">
          {tokens.map((token) => {
            const confirming = confirmId === token.id;
            return (
              <li
                key={token.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-all font-mono text-small text-ink">{token.url}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-muted">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLASS[token.status]}`}
                    >
                      {STATUS_LABEL[token.status]}
                    </span>
                    <span>Kedaluwarsa {token.expiresAt}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {token.status === "active" ? (
                    <CopyButton value={token.url} label="Salin tautan" absolute />
                  ) : null}

                  {token.status === "active" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          confirming ? void revoke(token.id) : setConfirmId(token.id)
                        }
                        disabled={revoking === token.id}
                        className={confirming ? BUTTON_DANGER : BUTTON_SMALL}
                      >
                        {revoking === token.id
                          ? "Mencabut…"
                          : confirming
                            ? "Yakin, cabut"
                            : "Cabut"}
                      </button>
                      {confirming ? (
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className={BUTTON_SMALL}
                        >
                          Batal
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
