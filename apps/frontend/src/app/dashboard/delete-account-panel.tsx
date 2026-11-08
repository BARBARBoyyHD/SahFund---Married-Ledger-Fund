"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage } from "@/components/app/form";
import { BUTTON_SECONDARY } from "@/components/landing/ui";
import { ACCOUNT_CONFIRM, ACCOUNT_WORKSPACE_PATH } from "@/lib/account-contract";

type OwnedWorkspace = {
  id: string;
  name: string;
  memberCount: number;
  requiresExplicitPath: boolean;
};

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; owned: OwnedWorkspace | null };

type ResponseBody = {
  message?: string;
  redirectTo?: string;
  ownedWorkspace?: OwnedWorkspace | null;
};

const BUTTON_DANGER =
  "inline-flex h-11 items-center justify-center rounded-sm bg-danger px-5 text-small font-bold text-surface transition-colors duration-150 hover:bg-danger/90 disabled:pointer-events-none disabled:opacity-60";

/**
 * US-40 (design D4): account deletion in the settings dialog. `GET /api/account` runs on
 * open so the owned-workspace path is stated before anything is destroyed; the second
 * checkbox is that explicit confirmation. Every server message is painted verbatim
 * (AGENTS §8) — a 409 means a member joined after the read, so the explicit path is
 * re-shown instead of retrying blind.
 */
export function DeleteAccountPanel() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "closed" });
  const [ackAccount, setAckAccount] = useState(false);
  const [ackWorkspace, setAckWorkspace] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function load() {
    setState({ kind: "loading" });
    setMessage(null);
    setAckAccount(false);
    setAckWorkspace(false);

    try {
      const response = await fetch("/api/account");
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setState({
          kind: "failed",
          message:
            typeof body?.message === "string"
              ? body.message
              : "Gagal memuat status akun. Coba lagi.",
        });
        return;
      }

      setState({ kind: "ready", owned: body?.ownedWorkspace ?? null });
    } catch {
      setState({
        kind: "failed",
        message: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      });
    }
  }

  async function remove() {
    if (pending || state.kind !== "ready") return;
    const owned = state.owned;
    if (!ackAccount || (owned && !ackWorkspace)) return;

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: ACCOUNT_CONFIRM,
          ...(owned?.requiresExplicitPath ? { workspacePath: ACCOUNT_WORKSPACE_PATH } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setMessage(
          typeof body?.message === "string" ? body.message : "Akun gagal dihapus. Coba lagi.",
        );
        // A member joined between the read and the delete: show the path again.
        if (response.status === 409 && body?.ownedWorkspace) {
          setState({ kind: "ready", owned: body.ownedWorkspace });
          setAckWorkspace(false);
        }
        return;
      }

      setDone(true);
      router.push(typeof body?.redirectTo === "string" ? body.redirectTo : "/login");
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="hapus-akun-judul" className="mt-6 border-t border-rule pt-5">
      <h3 id="hapus-akun-judul" className="text-small font-bold text-danger">
        Hapus akun
      </h3>
      <p className="mt-1 text-small text-ink-muted">
        Menghapus akun menghapus data Anda secara permanen. Tindakan ini tidak bisa dibatalkan.
      </p>

      {state.kind === "closed" ? (
        <button type="button" onClick={() => void load()} className={`${BUTTON_SECONDARY} mt-3`}>
          Hapus akun…
        </button>
      ) : null}

      {state.kind === "loading" ? (
        <p role="status" className="mt-3 text-small text-ink-muted">
          Memuat status akun…
        </p>
      ) : null}

      {state.kind === "failed" ? (
        <div className="mt-3">
          <FormMessage message={state.message} />
          <button type="button" onClick={() => void load()} className={BUTTON_SECONDARY}>
            Coba lagi
          </button>
        </div>
      ) : null}

      {done ? (
        <p
          role="status"
          className="mt-3 rounded-sm border border-emerald/20 bg-emerald-soft px-4 py-3 text-small font-semibold text-emerald"
        >
          Akun dan seluruh datanya sudah dihapus. Mengalihkan ke halaman masuk…
        </p>
      ) : null}

      {state.kind === "ready" && !done ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
          noValidate
          aria-busy={pending}
          className="mt-3"
        >
          <FormMessage message={message} />

          {state.owned?.requiresExplicitPath ? (
            <div className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3">
              <p className="text-small font-semibold text-ink">
                Workspace “{state.owned.name}” dipakai {state.owned.memberCount} anggota.
              </p>
              <p className="mt-1 text-small text-ink-muted">
                Menghapus akun ikut menghapus workspace itu beserta seluruh transaksi, impor,
                komitmen, dan anggotanya. Pengalihan kepemilikan belum tersedia, jadi anggota lain
                akan kehilangan akses.
              </p>
            </div>
          ) : state.owned ? (
            <p className="text-small text-ink-muted">
              Workspace “{state.owned.name}” milik Anda ikut terhapus beserta seluruh datanya.
            </p>
          ) : (
            <p className="text-small text-ink-muted">
              Akun ini tidak memiliki workspace. Keanggotaan Anda di workspace orang lain juga akan
              dihapus.
            </p>
          )}

          <label className="mt-3 flex items-start gap-2 text-small text-ink">
            <input
              type="checkbox"
              checked={ackAccount}
              onChange={(event) => setAckAccount(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-danger"
            />
            Saya mengerti akun ini akan dihapus permanen.
          </label>

          {state.owned ? (
            <label className="mt-2 flex items-start gap-2 text-small text-ink">
              <input
                type="checkbox"
                checked={ackWorkspace}
                onChange={(event) => setAckWorkspace(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-danger"
              />
              Saya mengerti workspace “{state.owned.name}” ikut terhapus.
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || !ackAccount || (state.owned !== null && !ackWorkspace)}
              className={BUTTON_DANGER}
            >
              {pending ? "Menghapus akun…" : "Hapus akun permanen"}
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: "closed" })}
              disabled={pending}
              className={BUTTON_SECONDARY}
            >
              Batal
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
