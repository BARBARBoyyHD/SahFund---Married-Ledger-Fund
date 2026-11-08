"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * US-03: one sign-out implementation. The header dropdown and the plain button on the
 * other dashboard pages share it, so the failure copy and the redirect can never drift.
 */
export function useSignOut() {
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

  return { signOut, pending, message };
}
