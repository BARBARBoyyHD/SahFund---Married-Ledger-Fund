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

/**
 * One graded emerald field — a single background, no plate inside it: warm gold glow
 * top-right, ledger rulings faint over the grade, two translucent sheets for depth.
 */
export function Hero() {
  return (
    <>
      <SiteHeader />

      <section className="hero-field relative isolate overflow-hidden text-pearl [--focus-ring:var(--color-gold)]">
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="ledger-rules pointer-events-none absolute inset-0 opacity-[0.07]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-28 size-[30rem] rotate-12 rounded-[3.5rem] border border-white/10 bg-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-32 size-[24rem] -rotate-12 rounded-[3rem] border border-white/[0.07] bg-white/[0.02]"
        />

        <Container className="relative pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-x-16">
            <div>
              <div
                aria-hidden="true"
                className="enter h-px w-14 bg-gold"
                style={{ "--d": "0ms" } as CSSProperties}
              />

              <h1 className="mt-6 text-display font-extrabold">
                <span className="line-mask">
                  <span style={{ "--line": 0 } as CSSProperties}>
                    Dana nikah,
                  </span>
                </span>
                <span className="line-mask">
                  <span style={{ "--line": 1 } as CSSProperties}>tercatat</span>
                </span>
                <span className="line-mask">
                  <span
                    className="text-gold"
                    style={{ "--line": 2 } as CSSProperties}
                  >
                    berdua.
                  </span>
                </span>
              </h1>

              <p
                className="enter mt-8 max-w-[38ch] text-body text-pearl-muted"
                style={{ "--d": "300ms" } as CSSProperties}
              >
                Impor mutasi rekening, cocokkan dengan saldo yang dicetak bank,
                lalu lihat proyeksinya sampai hari H.
              </p>

              <div
                className="enter mt-8 flex flex-wrap items-center gap-x-7 gap-y-4"
                style={{ "--d": "380ms" } as CSSProperties}
              >
                <Link href="/login" className={BUTTON_ON_EMERALD}>
                  Buat akun
                </Link>
                <Link href="/login?mode=masuk" className={TEXT_LINK_ON_EMERALD}>
                  Sudah punya akun? Masuk
                </Link>
              </div>
            </div>

            <div
              className="enter-card w-full lg:justify-self-end"
              style={{ "--d": "460ms" } as CSSProperties}
            >
              <div className="relative mx-auto max-w-[520px]">
                {/* The page behind: a translucent second sheet, not a second background. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 translate-x-4 translate-y-4 rounded-lg border border-white/15 bg-white/[0.06]"
                />
                <div className="relative">
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
          </div>
        </Container>
      </section>
    </>
  );
}
