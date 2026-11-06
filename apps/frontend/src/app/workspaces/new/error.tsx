"use client";

import { RetryPanel } from "@/components/app/retry-panel";

/** A session/DB read failed: explicit error + retry, never a blank create screen. */
export default function NewWorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <RetryPanel onRetry={retry} />
    </main>
  );
}
