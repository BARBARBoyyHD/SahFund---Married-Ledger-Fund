import Link from "next/link";

import {
  Container,
  BUTTON_ON_EMERALD,
} from "@/components/landing/ui";

const FOOTER_LINKS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#yang-dicatat", label: "Yang dicatat" },
  // TODO(payment): re-add { href: "#harga", label: "Harga" } when PAYMENT_ENABLED — see docs/projects/NOTE-payment-disabled.md
  { href: "#pertanyaan", label: "Pertanyaan" },
];

/** The close flips the page: emerald field, the same invitation, one action (DESIGN.md bookend). */
export function Close() {
  return (
    <div className="hero-field text-pearl [--focus-ring:var(--color-gold)]">
      <section className="flex min-h-[80svh] flex-col justify-between pt-20 pb-10 lg:pt-28">
        <Container>
          <h2 data-reveal className="text-display font-extrabold">
            Mulai dari
            <br />
            satu impor.
          </h2>
        </Container>

        <Container className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          {/* TODO(payment): restore pricing copy when PAYMENT_ENABLED — see docs/projects/NOTE-payment-disabled.md */}
          <p data-reveal className="max-w-[40ch] text-body text-pearl-muted">
            Buat akun, impor mutasi, cocokkan dengan saldo yang dicetak bank,
            lalu lihat proyeksinya. Semua fitur terbuka tanpa biaya; pembelian
            belum tersedia untuk sementara.
          </p>
          <Link href="/login" className={`${BUTTON_ON_EMERALD} shrink-0`}>
            Buat akun
          </Link>
        </Container>
      </section>

      <footer className="pb-8">
        <Container className="pt-24 lg:pt-40">
          <div className="flex flex-col gap-2 border-t border-gold/40 pt-6 text-small text-pearl-muted md:grid md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-6">
            <p>Pelacak dana nikah dua orang</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 md:justify-center">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="underline decoration-gold underline-offset-4 transition-colors duration-150 hover:decoration-pearl"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="md:text-right">© 2026 SahFund</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
