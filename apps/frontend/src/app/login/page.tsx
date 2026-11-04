import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { Container } from "@/components/landing/ui";
import { Wordmark } from "@/components/mark";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = {
  title: "Masuk atau buat akun",
  description:
    "Masuk ke SahFund atau buat akun untuk mulai mencatat dana nikah berdua.",
};

function LoginSkeleton() {
  return (
    <div aria-hidden="true" className="mt-7">
      <div className="h-12 rounded-sm bg-neutral" />
      <div className="mt-8 space-y-5">
        <div className="h-[72px] rounded-sm bg-neutral" />
        <div className="h-[72px] rounded-sm bg-neutral" />
        <div className="h-12 rounded-sm bg-neutral" />
      </div>
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="pt-7">
        <Container>
          <Link href="/" className="inline-block rounded-xs">
            <Wordmark />
          </Link>
        </Container>
      </header>

      <Container className="flex flex-1 flex-col justify-center py-12">
        <div className="w-full max-w-[420px]">
          <h1 className="text-h2 font-bold">Masuk atau buat akun</h1>
          <p className="mt-2 text-body text-muted">
            Satu akun untuk mencatat dana nikah berdua.
          </p>

          <Suspense fallback={<LoginSkeleton />}>
            <LoginPanel searchParams={searchParams} />
          </Suspense>

          <p className="mt-8 text-small text-muted">
            <Link
              href="/"
              className="underline decoration-line underline-offset-4 transition-colors duration-150 hover:text-tertiary hover:decoration-tertiary"
            >
              Kembali ke beranda
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
