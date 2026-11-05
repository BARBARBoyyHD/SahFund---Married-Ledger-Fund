"use client";

import { RetryPanel } from "@/components/app/retry-panel";

/** A read failed: explicit error + retry, never a blank workspace or a zeroed total. */
export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <RetryPanel onRetry={retry} />
    </main>
  );
}
