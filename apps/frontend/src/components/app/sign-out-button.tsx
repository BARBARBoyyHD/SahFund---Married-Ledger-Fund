"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUTTON_SMALL } from "@/components/app/ui";

/**
 * US-03: sign-out clears the session server-side (`/api/auth/sign-out` relays Better
 * Auth's cleared cookie) and lands on `/login`. A failure is shown verbatim — the
 * button stays live, so it is also the retry.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          typeof body?.message === "string" ? body.message : "Gagal keluar. Coba lagi sebentar lagi.",
        );
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? (
        <p role="alert" className="text-small font-semibold text-danger">
          {message}
        </p>
      ) : null}
      <button type="button" onClick={signOut} disabled={pending} className={BUTTON_SMALL}>
        {pending ? "Keluar…" : "Keluar"}
      </button>
    </div>
  );
}
