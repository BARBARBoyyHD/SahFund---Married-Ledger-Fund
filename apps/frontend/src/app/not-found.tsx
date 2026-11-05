import Link from "next/link";

import { Container, BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/landing/ui";
import { Wordmark } from "@/components/mark";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="pt-7">
        <Container>
          <Link href="/" className="inline-block rounded-xs">
            <Wordmark />
          </Link>
        </Container>
      </header>

      <Container className="flex flex-1 flex-col justify-center py-16">
        <div className="max-w-[46ch]">
          <h1 className="text-display font-extrabold">
            Halaman ini
            <br />
            tidak ada.
          </h1>
          <p className="mt-6 text-body text-muted">
            Alamat yang kamu buka tidak ada di SahFund. Mungkin tautannya sudah
            usang atau salah ketik.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={BUTTON_PRIMARY}>
              Kembali ke beranda
            </Link>
            <Link href="/login?mode=masuk" className={BUTTON_SECONDARY}>
              Masuk ke akun
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
