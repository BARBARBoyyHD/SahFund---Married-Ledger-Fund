"use client";

import { RetryPanel } from "@/components/app/retry-panel";

/** AGENTS §8: a dead database is an explicit error + retry, never a blank dashboard. */
export default function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <RetryPanel onRetry={retry} />
    </main>
  );
}
