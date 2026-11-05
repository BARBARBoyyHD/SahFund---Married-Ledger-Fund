"use client";

import { useState } from "react";

import { BUTTON_SMALL } from "@/components/app/ui";

/**
 * Copies the exact string it was given (the API's `joinUrl` verbatim, never rebuilt).
 * If the clipboard is unavailable the text is still on screen to select by hand — the
 * button says so instead of failing silently.
 */
export function CopyButton({
  value,
  label,
  absolute = false,
}: {
  value: string;
  label: string;
  /** The value is a site-relative path; copy it as a full link the partner can open. */
  absolute?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      const text = absolute ? new URL(value, window.location.origin).toString() : value;
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={BUTTON_SMALL}>
        {label}
      </button>
      <span aria-live="polite" className="text-small text-ink-muted">
        {state === "copied" ? "Tersalin" : null}
        {state === "failed" ? "Tidak bisa menyalin. Salin manual dari teks di atas." : null}
      </span>
    </span>
  );
}
