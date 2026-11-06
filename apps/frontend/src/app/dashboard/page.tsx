import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { PageSkeleton } from "@/components/app/skeleton";
import { SignOutButton } from "@/components/app/sign-out-button";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Container, Eyebrow } from "@/components/landing/ui";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Design D11: the dashboard is a resolver, not a report. Signed out → `/login`
 * (`requireSession`); member → their one workspace; no workspace → the create prompt.
 * The session read is runtime data, so it streams behind `<Suspense>` (Cache
 * Components) — the fallback is the loading state.
 */
export default function DashboardPage() {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <Suspense fallback={<PageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const session = await requireSession();

  // The one membership row for this user (UNIQUE(members.userId)); scoped by the
  // session's own id, never by anything the client sent (AGENTS §4).
  const [membership] = await getDb()
    .select({ workspaceId: members.workspaceId })
    .from(members)
    .where(eq(members.userId, session.user.id))
    .limit(1);

  if (membership) redirect(`/w/${membership.workspaceId}`);

  return (
    <>
      <AppHeader userName={session.user.name} action={<SignOutButton />} />

      <Container className="py-14 lg:py-20">
        <div className="max-w-[52ch]">
          <Eyebrow>Langkah pertama</Eyebrow>
          <h1 className="mt-4 text-h2 font-bold text-ink">Belum ada workspace</h1>
          <p className="mt-4 text-body text-ink-muted">
            Satu workspace menampung dana nikah kalian berdua: catatan mutasi, target
            anggaran, dan proyeksi sampai hari H.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/workspaces/new" className={BUTTON_PRIMARY}>
              Buat workspace
            </Link>
            <Link href="/join" className={BUTTON_SECONDARY}>
              Punya kode undangan?
            </Link>
          </div>
          <p className="mt-6 text-small text-ink-muted">
            Sudah diundang pasanganmu? Buka tautan undangannya, atau masukkan kode
            10 karakter di halaman gabung.
          </p>
        </div>
      </Container>
    </>
  );
}
