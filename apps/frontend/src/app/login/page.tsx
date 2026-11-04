import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { Wordmark } from "@/components/mark";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = {
  title: "Masuk atau buat akun",
  description:
    "Masuk ke SahFund atau buat akun untuk mulai mencatat dana nikah berdua.",
};

function LoginSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-12 rounded-sm bg-emerald-soft" />
      <div className="mt-6 space-y-5">
        <div className="h-[68px] rounded-sm bg-emerald-soft" />
        <div className="h-[68px] rounded-sm bg-emerald-soft" />
        <div className="h-12 rounded-sm bg-emerald-soft" />
      </div>
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="min-h-svh bg-pearl text-ink lg:grid lg:grid-cols-2">
      {/* The same graded field as the landing hero: brand on the left, work on the right. */}
      <aside className="hero-field relative isolate overflow-hidden px-6 py-8 text-pearl [--focus-ring:var(--color-gold)] lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="ledger-rules pointer-events-none absolute inset-0 opacity-[0.07]"
        />

        <div className="relative">
          <Link href="/" className="inline-block rounded-xs">
            <Wordmark inverse />
          </Link>
        </div>

        <div
          className="enter relative mt-10 hidden lg:block"
          style={{ "--d": "80ms" } as CSSProperties}
        >
          <p className="max-w-[13ch] text-h2 font-bold text-balance">
            Dana nikah, tercatat berdua.
          </p>
          <p className="mt-5 max-w-[34ch] text-body text-pearl-muted">
            Satu impor, satu angka yang cocok dengan saldo bank, dan proyeksi
            sampai hari H.
          </p>
        </div>

        <div
          className="enter relative mt-12 hidden lg:block"
          style={{ "--d": "180ms" } as CSSProperties}
        >
          <div aria-hidden="true" className="h-px w-full bg-gold/40" />
          <p className="mt-4 text-small text-pearl-muted">
            Pelacak dana nikah dua orang
          </p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12 lg:px-14 lg:py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="enter text-h2 font-bold text-ink">
            Masuk atau buat akun
          </h1>
          <p
            className="enter mt-3 text-body text-ink-muted"
            style={{ "--d": "60ms" } as CSSProperties}
          >
            Satu akun untuk mencatat dana nikah berdua.
          </p>

          <div
            className="enter card-sheen mt-8 rounded-md border border-gold/60 p-5 shadow-card lg:p-6"
            style={{ "--d": "140ms" } as CSSProperties}
          >
            <Suspense fallback={<LoginSkeleton />}>
              <LoginPanel searchParams={searchParams} />
            </Suspense>
          </div>

          <p
            className="enter mt-8 text-small text-ink-muted"
            style={{ "--d": "220ms" } as CSSProperties}
          >
            <Link
              href="/"
              className="underline decoration-gold-line underline-offset-4 transition-colors duration-150 hover:text-emerald hover:decoration-emerald"
            >
              Kembali ke beranda
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
