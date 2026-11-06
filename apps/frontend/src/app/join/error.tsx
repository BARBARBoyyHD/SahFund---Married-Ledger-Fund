"use client";

import { RetryPanel } from "@/components/app/retry-panel";

/** A session read failed: explicit error + retry, never a blank join screen. */
export default function JoinError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <RetryPanel onRetry={retry} />
    </main>
  );
}
