import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/app/skeleton";
import { WorkspaceShell } from "./workspace-shell";

export const metadata: Metadata = { title: "Workspace" };

/**
 * US-04: the URL id is never enough — `WorkspaceShell` resolves the caller's membership
 * server-side (`requireMembership` redirects to `/login` or renders not-found). The
 * read streams behind `<Suspense>`; the fallback is the loading state.
 */
export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <Suspense fallback={<PageSkeleton />}>
        <WorkspaceShell params={params} />
      </Suspense>
    </main>
  );
}
