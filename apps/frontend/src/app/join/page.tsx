import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AppHeader } from "@/components/app/app-header";
import { PageSkeleton } from "@/components/app/skeleton";
import { SignOutButton } from "@/components/app/sign-out-button";
import { BUTTON_SMALL, CARD } from "@/components/app/ui";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Container, Eyebrow } from "@/components/landing/ui";
import { getSession } from "@/lib/session";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Gabung ke workspace" };

/**
 * US-06 manual entry and US-53 invite link, one screen. The code lives in the URL
 * (shareable, back-button correct) and pre-fills the form; signed-out visitors get the
 * sign-in detour with `next` carrying the code back (design D8). `/join` is deliberately
 * reachable without a session (design D12).
 */
export default function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] | undefined }>;
}) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <Suspense fallback={<PageSkeleton />}>
        <JoinContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function JoinContent({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.trim() : "";
  const session = await getSession();

  const nextPath = code ? `/join?code=${encodeURIComponent(code)}` : "/join";
  const signInHref = `/login?mode=masuk&next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <AppHeader
        homeHref={session ? "/dashboard" : "/"}
        userName={session?.user.name}
        action={
          session ? (
            <SignOutButton />
          ) : (
            <Link href={signInHref} className={BUTTON_SMALL}>
              Masuk
            </Link>
          )
        }
      />

      <Container className="py-12 lg:py-16">
        <div className="max-w-[540px]">
          <Eyebrow>Undangan</Eyebrow>
          <h1 className="mt-4 text-h2 font-bold text-ink">Gabung ke workspace</h1>

          {session ? (
            <>
              <p className="mt-3 text-body text-ink-muted">
                {code
                  ? "Periksa kodenya, lalu konfirmasi untuk bergabung ke workspace pasanganmu."
                  : "Masukkan kode undangan 10 karakter yang kamu terima, lalu konfirmasi."}
              </p>
              <div className={`${CARD} mt-8`}>
                <JoinForm key={code} initialCode={code} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-body text-ink-muted">
                Masuk dulu untuk bergabung
                {code ? ". Kode undanganmu sudah tersimpan di tautan ini." : "."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={signInHref} className={BUTTON_PRIMARY}>
                  Masuk untuk bergabung
                </Link>
                <Link href="/login" className={BUTTON_SECONDARY}>
                  Buat akun
                </Link>
              </div>
              {code ? (
                <p className="mt-6 text-small text-ink-muted">
                  Kode undangan:{" "}
                  <code className="font-mono tracking-[0.12em] text-ink">{code}</code>
                </p>
              ) : null}
            </>
          )}
        </div>
      </Container>
    </>
  );
}
