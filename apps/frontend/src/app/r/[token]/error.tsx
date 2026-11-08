"use client";

import { RetryPanel } from "@/components/app/retry-panel";

/** AGENTS §8: a dead database on the shared page is a retry state, never an error dump. */
export default function ShareReportError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-svh bg-surface text-ink [--focus-ring:var(--color-emerald)]">
      <RetryPanel onRetry={retry} />
    </main>
  );
}
