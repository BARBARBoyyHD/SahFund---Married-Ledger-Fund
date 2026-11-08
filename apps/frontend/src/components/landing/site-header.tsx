import Link from "next/link";

import { Wordmark } from "@/components/mark";
import { Container } from "@/components/landing/ui";

const LINKS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#yang-dicatat", label: "Yang dicatat" },
  // TODO(payment): re-add { href: "#harga", label: "Harga" } when PAYMENT_ENABLED — see docs/projects/NOTE-payment-disabled.md
];

/**
 * Solid pearl chrome on a gold hairline, sticky with no script. Kept light so the emerald
 * hero below it reads as the page's first surface, not as the top of the navbar.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gold/60 bg-pearl shadow-nav">
      <Container>
        <nav
          aria-label="Utama"
          className="flex h-16 items-center justify-between gap-6 lg:h-[72px]"
        >
          <Link href="/" className="rounded-xs">
            <Wordmark />
          </Link>

          <ul className="hidden items-center gap-9 text-small md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="relative inline-block font-medium text-ink-muted transition-colors duration-150 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-200 hover:text-emerald hover:after:scale-x-100 focus-visible:after:scale-x-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/login?mode=masuk"
            className="inline-flex h-9 items-center rounded-sm border border-emerald px-4 text-small font-bold text-emerald transition-colors duration-150 hover:bg-emerald-soft"
          >
            Masuk
          </Link>
        </nav>
      </Container>
    </header>
  );
}
