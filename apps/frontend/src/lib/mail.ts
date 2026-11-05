/**
 * The only email v1.0 sends (BRD FR-13): a text-only Bahasa Indonesia invite carrying
 * the pocket code and the join link — no attachments, no financial data (NFR-01), no
 * SDK (ITA §4.1, design D9). Plain `fetch`, a bounded timeout, and a typed result so the
 * route can answer `fallback` instead of failing.
 *
 * Nothing in this module logs: the caller receives a reason and logs that reason only —
 * never the code, the recipient, or the body (ITA §11.9).
 */

declare global {
  interface CloudflareEnv {
    /** `wrangler secret put RESEND_API_KEY` / `.dev.vars`. Absent = manual fallback. */
    RESEND_API_KEY?: string;
    /** Verified sender, e.g. `SahFund <invite@sahfund.id>`. Absent = manual fallback. */
    RESEND_FROM?: string;
  }
}

export type MailConfig = { apiKey?: string; from?: string };

export type SendInviteResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "rejected" | "network"; status?: number };

/** Subject and body of the invite, kept separate so a test can read what would be sent. */
export function inviteEmail(input: { code: string; joinUrl: string }) {
  return {
    subject: "Undangan bergabung di SahFund",
    text: [
      "Halo,",
      "",
      "Anda diundang bergabung di workspace dana nikah di SahFund.",
      "",
      `Kode pocket: ${input.code}`,
      "Gabung lewat tautan ini:",
      input.joinUrl,
      "",
      "Buka tautan tersebut, masuk atau buat akun, lalu konfirmasi sekali untuk bergabung.",
      "Kode yang sama juga bisa dimasukkan manual di halaman Gabung.",
      "",
      "Salam,",
      "SahFund",
    ].join("\n"),
  };
}

export async function sendInviteEmail(
  input: { to: string; code: string; joinUrl: string },
  config: MailConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SendInviteResult> {
  // No key or no sender is a configuration gap, not an error: the screen falls back to
  // showing the code and link (US-52).
  if (!config.apiKey || !config.from) return { ok: false, reason: "not-configured" };

  const { subject, text } = inviteEmail(input);

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [input.to], subject, text }),
      // A hung API must not hang the route (design D9).
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return { ok: false, reason: "rejected", status: response.status };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
