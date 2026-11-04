import Link from "next/link";

import { Wordmark } from "@/components/mark";
import { Container } from "@/components/landing/ui";

const LINKS = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#yang-dicatat", label: "Yang dicatat" },
  { href: "#harga", label: "Harga" },
];

/** Sits inside the emerald hero band, so every tone here is pearl/gold. */
export function SiteHeader() {
  return (
    <header className="pt-7">
      <Container>
        <nav
          aria-label="Utama"
          className="flex items-center justify-between gap-6"
        >
          <Link href="/" className="rounded-xs">
            <Wordmark inverse />
          </Link>
          <ul className="hidden items-center gap-8 text-small text-pearl-muted md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition-colors duration-150 hover:text-pearl"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/login?mode=masuk"
            className="text-small font-semibold text-pearl underline decoration-gold underline-offset-4 transition-colors duration-150 hover:decoration-pearl"
          >
            Masuk
          </Link>
        </nav>
      </Container>
    </header>
  );
}
