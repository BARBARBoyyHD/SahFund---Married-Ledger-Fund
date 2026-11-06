"use client";

import Link from "next/link";

import { BUTTON_PRIMARY, Container } from "@/components/landing/ui";
import { Wordmark } from "@/components/mark";

/**
 * The error state every protected screen must have (AGENTS §6/§8): a real message and
 * a retry wired to Next's error boundary. The thrown error's details stay in the
 * server log; the user gets the retry, never a blank page or a zeroed-out total.
 */
export function RetryPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <Container className="flex min-h-svh flex-col py-8">
      <Link href="/" className="inline-block w-fit rounded-xs">
        <Wordmark />
      </Link>

      <div className="flex flex-1 flex-col justify-center py-12">
        <div className="max-w-[46ch]">
          <h1 className="text-h2 font-bold text-ink">Layanan sedang tidak tersedia</h1>
          <p className="mt-4 text-body text-ink-muted">
            Kami tidak bisa memuat data saat ini. Data Anda tidak berubah — coba lagi
            sebentar lagi.
          </p>
          <button type="button" onClick={onRetry} className={`${BUTTON_PRIMARY} mt-8`}>
            Coba lagi
          </button>
        </div>
      </div>
    </Container>
  );
}
