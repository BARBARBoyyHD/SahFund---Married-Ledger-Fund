import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/app/skeleton";
import { DashboardContent } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Signed out → `/login` (`requireSession`); no workspace → the create/join prompt;
 * member → the read-only dashboard (design D11 revised). The session read is runtime
 * data, so it streams behind `<Suspense>`; the fallback is the loading state.
 */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
