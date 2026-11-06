"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyButton } from "@/components/app/copy-button";
import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { BUTTON_SMALL, LINK } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { fieldErrors, type FieldErrors } from "@/lib/validation";
import { inviteSchema } from "@/lib/workspace/schema";

type EmailValues = { email: string };

type InviteBody = {
  status?: string;
  code?: string;
  joinUrl?: string;
  message?: string;
  fieldErrors?: FieldErrors<EmailValues>;
};

type Outcome =
  | { status: "sent" }
  | { status: "fallback"; code: string; joinUrl: string };

const NOTICE = {
  sent: "Undangan sudah dikirim ke email pasanganmu.",
  rotated: "Kode undangan sudah diganti. Kode lama tidak berlaku lagi.",
} as const;

/**
 * US-07 / US-52 / US-53. The owner sends the pocket invite; on any send failure the API
 * answers `fallback` and this panel shows the returned code and join URL verbatim for
 * manual copying — plus a retry that works with no `RESEND_API_KEY`. A refused send
 * (429) renders the server's message as-is. Rotating is owner-only in the UI; the
 * handler enforces it regardless (design D10).
 */
export function InvitePanel({
  workspaceId,
  inviteCode,
  joinPath,
  isOwner,
}: {
  workspaceId: string;
  inviteCode: string;
  joinPath: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors<EmailValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function sendInvite() {
    if (pending) return;

    setError(null);
    setNotice(null);

    const parsed = inviteSchema.safeParse({ email });
    if (!parsed.success) {
      const next = fieldErrors<EmailValues>(parsed.error);
      setErrors(next);
      document.getElementById("email")?.focus();
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email }),
      });
      const body = (await response.json().catch(() => null)) as InviteBody | null;

      if (!response.ok) {
        // 403 owner-only, 429 rate limit, 422 field error, 503 — all verbatim.
        const next = body?.fieldErrors ?? {};
        setErrors(next);
        setOutcome(null);
        setError(typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.");
        if (next.email) document.getElementById("email")?.focus();
        return;
      }

      if (body?.status === "sent") {
        setOutcome({ status: "sent" });
        setNotice(NOTICE.sent);
        return;
      }

      if (body?.status === "fallback" && body.code && body.joinUrl) {
        // Use the API's code and join URL as-is — never rebuilt on the client.
        setOutcome({ status: "fallback", code: body.code, joinUrl: body.joinUrl });
        return;
      }

      setError("Permintaan gagal. Coba lagi.");
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function rotate() {
    if (rotating) return;
    if (!window.confirm("Ganti kode undangan? Kode lama langsung tidak berlaku.")) return;

    setRotating(true);
    setError(null);
    setNotice(null);
    setOutcome(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/rotate`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as InviteBody | null;

      if (!response.ok) {
        setError(
          typeof body?.message === "string" ? body.message : "Gagal mengganti kode. Coba lagi.",
        );
        return;
      }

      setNotice(NOTICE.rotated);
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div>
      <p className="text-small font-bold text-ink">Kode undangan</p>
      <p className="mt-1 font-mono text-h3 tracking-[0.18em] text-emerald">{inviteCode}</p>
      <p className="mt-1 text-small text-ink-muted">
        Bagikan kode ini atau tautan undangan ke pasanganmu.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={inviteCode} label="Salin kode" />
      </div>

      <p className="mt-5 text-small font-bold text-ink">Tautan undangan</p>
      <a href={joinPath} className={`${LINK} mt-1 block text-small break-all`}>
        {joinPath}
      </a>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton value={joinPath} label="Salin tautan" absolute />
      </div>

      <div className="mt-6 border-t border-gold/40 pt-5">
        <FormMessage message={error} />
        <div aria-live="polite">
          {notice ? (
            <p className="mb-5 rounded-sm border border-emerald/20 bg-emerald-soft px-4 py-3 text-small font-semibold text-emerald">
              {notice}
            </p>
          ) : null}
        </div>

        {isOwner ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendInvite();
              }}
              noValidate
              aria-busy={pending}
            >
              <Field
                id="email"
                label="Email pasangan"
                hint="Undangan berisi kode dan tautan; tanpa data keuangan."
                error={errors.email}
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors({});
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy("email", { hint: true, error: errors.email })}
                  className={inputClass(errors.email)}
                />
              </Field>

              <button
                type="submit"
                disabled={pending}
                className={`${BUTTON_PRIMARY} w-full disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
              >
                {pending ? "Mengirim…" : "Kirim undangan"}
              </button>
            </form>

            <div aria-live="polite">
              {outcome?.status === "fallback" ? (
                <div className="mt-5 rounded-sm border border-gold/60 bg-emerald-mist p-4">
                  <p className="text-small font-bold text-ink">Email belum terkirim.</p>
                  <p className="mt-1 text-small text-ink-muted">
                    Undangannya tetap berlaku. Bagikan kode dan tautan ini secara manual,
                    lalu coba kirim lagi.
                  </p>
                  <p className="mt-3 font-mono text-h3 tracking-[0.18em] text-emerald">
                    {outcome.code}
                  </p>
                  <a
                    href={outcome.joinUrl}
                    className={`${LINK} mt-1 block text-small break-all`}
                  >
                    {outcome.joinUrl}
                  </a>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CopyButton value={outcome.code} label="Salin kode" />
                    <CopyButton value={outcome.joinUrl} label="Salin tautan" />
                    <button
                      type="button"
                      onClick={() => void sendInvite()}
                      disabled={pending}
                      className={BUTTON_SMALL}
                    >
                      {pending ? "Mengirim…" : "Coba kirim lagi"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 border-t border-gold/40 pt-4">
              <p className="text-small text-ink-muted">
                Ganti kode kalau kode lama sudah tersebar ke orang yang salah. Kode lama
                langsung tidak berlaku.
              </p>
              <button
                type="button"
                onClick={() => void rotate()}
                disabled={rotating}
                className={`${BUTTON_SMALL} mt-3`}
              >
                {rotating ? "Mengganti…" : "Ganti kode undangan"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-small text-ink-muted">
            Hanya pemilik workspace yang bisa mengirim undangan lewat email atau mengganti
            kode.
          </p>
        )}
      </div>
    </div>
  );
}
