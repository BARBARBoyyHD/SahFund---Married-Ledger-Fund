import type { CSSProperties } from "react";
import Link from "next/link";

import {
  Container,
  BUTTON_ON_EMERALD,
  TEXT_LINK_ON_EMERALD,
} from "@/components/landing/ui";
import { ReconcileDemo } from "@/components/landing/reconcile-demo";
import { SiteHeader } from "@/components/landing/site-header";
import { CLOSING_MINOR, EXAMPLE, OPENING_MINOR, ROWS } from "@/lib/landing-demo";

export function Hero() {
  return (
    <div className="bg-emerald text-pearl [--focus-ring:var(--color-gold)]">
      <SiteHeader />

      <Container className="pt-12 pb-12 lg:pt-16 lg:pb-16">
        <h1 className="text-display font-extrabold">
          <span className="line-mask">
            <span style={{ "--line": 0 } as CSSProperties}>Dana nikah,</span>
          </span>
          <span className="line-mask">
            <span
              className="text-gold"
              style={{ "--line": 1 } as CSSProperties}
            >
              tercatat berdua.
            </span>
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:gap-0">
          <div className="lg:col-span-5 lg:pr-10 lg:pt-2">
            <p className="max-w-[40ch] text-body text-pearl-muted">
              Impor mutasi rekening, cocokkan dengan saldo yang dicetak bank,
              lalu lihat proyeksinya sampai hari H.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/login" className={BUTTON_ON_EMERALD}>
                Buat akun
              </Link>
              <Link href="/login?mode=masuk" className={TEXT_LINK_ON_EMERALD}>
                Sudah punya akun? Masuk
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="-mx-6 bg-emerald-deep px-4 py-8 [clip-path:polygon(72px_0,100%_0,100%_100%,0_100%,0_72px)] lg:-mr-12 lg:px-14 lg:py-12">
              <ReconcileDemo
                rows={ROWS}
                openingMinor={OPENING_MINOR}
                closingMinor={CLOSING_MINOR}
                bank={EXAMPLE.bank}
                pocket={EXAMPLE.pocket}
                period={EXAMPLE.period}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
