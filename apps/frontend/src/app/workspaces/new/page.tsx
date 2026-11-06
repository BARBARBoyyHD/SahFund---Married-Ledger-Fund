import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { PageSkeleton } from "@/components/app/skeleton";
import { SignOutButton } from "@/components/app/sign-out-button";
import { CARD, LINK } from "@/components/app/ui";
import { Container, Eyebrow } from "@/components/landing/ui";
import { requireSession } from "@/lib/session";
import { CreateWorkspaceForm } from "./create-form";

export const metadata: Metadata = { title: "Buat workspace" };

/** US-01's landing target: a new account creates its one workspace here. */
export default function NewWorkspacePage() {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <Suspense fallback={<PageSkeleton />}>
        <NewWorkspaceContent />
      </Suspense>
    </main>
  );
}

async function NewWorkspaceContent() {
  const session = await requireSession();

  return (
    <>
      <AppHeader userName={session.user.name} action={<SignOutButton />} />

      <Container className="py-12 lg:py-16">
        <div className="max-w-[560px]">
          <Eyebrow>Langkah kedua</Eyebrow>
          <h1 className="mt-4 text-h2 font-bold text-ink">Buat workspace</h1>
          <p className="mt-3 text-body text-ink-muted">
            Beri nama dana nikah kalian. Tanggal dan target anggaran bisa diisi sekarang
            atau nanti dari dashboard.
          </p>

          <div className={`${CARD} mt-8`}>
            <CreateWorkspaceForm />
          </div>

          <p className="mt-6 text-small text-ink-muted">
            Sudah punya kode undangan?{" "}
            <Link href="/join" className={LINK}>
              Gabung ke workspace pasanganmu
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
