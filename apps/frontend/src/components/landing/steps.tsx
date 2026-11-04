"use client";

import { useEffect, useRef, useState } from "react";

import { formatRupiah } from "@/core/money";
import { Container, Eyebrow } from "@/components/landing/ui";
import { CLOSING_MINOR, FORECAST, EXAMPLE } from "@/lib/landing-demo";

/**
 * The sheet's pinned section: one stage on the right, three statements on the left,
 * the fragment switching to whatever statement is being read.
 */
const STEPS = [
  {
    title: "Impor mutasi rekening",
    body: "Unduh mutasi dari aplikasi bank, lalu impor berkasnya. PDF Jago dan CSV bank lain terbaca di perangkat, dan tidak ada dokumen yang diunggah.",
  },
  {
    title: "Cocokkan dengan saldo bank",
    body: "Catatan baru dihitung setelah angkanya sama dengan saldo yang dicetak bank. Kalau beda, selisihnya ditunjukkan lebih dulu.",
  },
  {
    title: "Lihat proyeksi sampai hari H",
    body: "Sisa bulan, komitmen yang belum lunas, dan setoran bulanan yang dibutuhkan, dijadikan satu angka.",
  },
] as const;

function FragmentImport() {
  return (
    <div data-ui className="rounded-sm border border-gold card-sheen bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">mutasi-jago-agustus.pdf</p>
          <p className="mt-1 text-small text-ink-muted">
            38 transaksi · 1 halaman
          </p>
        </div>
        <p className="shrink-0 text-small font-bold text-emerald">Terbaca</p>
      </div>
      <p className="mt-4 text-small text-ink-muted">
        Dibaca di perangkat ini. Tidak ada dokumen yang dikirim ke server.
      </p>
      <div className="mt-4 rounded-xs bg-emerald-soft p-3 text-small text-ink-muted">
        Bank lain? Ekspor CSV atau Excel, lalu petakan kolomnya sekali.
      </div>
    </div>
  );
}

function FragmentReconcile() {
  return (
    <div data-ui className="rounded-sm border border-gold card-sheen bg-surface p-5">
      <dl className="space-y-1 text-small">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Saldo menurut catatan</dt>
          <dd className="font-semibold tabular-nums">
            {formatRupiah(CLOSING_MINOR)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Saldo tercetak bank</dt>
          <dd className="font-semibold tabular-nums">
            {formatRupiah(CLOSING_MINOR)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 inline-flex items-center gap-2 font-bold text-emerald">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 rounded-[3px] bg-emerald"
        />
        Cocok dengan saldo bank.
      </p>
      <p className="mt-4 text-small text-ink-muted">
        Impor yang belum cocok tetap tersimpan, ditandai, dan tidak dihitung ke
        total.
      </p>
    </div>
  );
}

function FragmentForecast() {
  return (
    <div data-ui className="rounded-sm border border-gold card-sheen bg-surface p-5">
      <p className="text-small text-ink-muted">
        Proyeksi {EXAMPLE.weddingDate}
      </p>
      <p className="mt-2 text-h2 font-extrabold tabular-nums">
        {formatRupiah(FORECAST.shortfallAmountMinor)}
      </p>
      <p className="text-small text-ink-muted">masih kurang</p>
      <div className="mt-4 rounded-xs bg-emerald-soft p-3 text-small">
        Sisihkan{" "}
        <strong className="font-bold tabular-nums">
          {formatRupiah(FORECAST.requiredMonthlyDepositMinor)}
        </strong>{" "}
        per bulan, {FORECAST.monthsLeft} bulan lagi.
      </div>
    </div>
  );
}

const FRAGMENTS = [FragmentImport, FragmentReconcile, FragmentForecast];

export function Steps() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.step));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const el of steps.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const Stage = FRAGMENTS[active];

  return (
    <section
      id="cara-kerja"
      className="scroll-mt-20 py-16 lg:scroll-mt-24 lg:py-24"
    >
      <Container>
        <Eyebrow>Proses</Eyebrow>
        <h2 className="mt-4 text-h2 font-bold text-ink">Cara kerja</h2>

        <div className="mt-10 lg:mt-16 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                data-step={index}
                ref={(el) => {
                  steps.current[index] = el;
                }}
                className={
                  index > 0
                    ? "mt-12 border-0 lg:mt-0 lg:flex lg:min-h-[46svh] lg:flex-col lg:justify-center"
                    : "lg:flex lg:min-h-[46svh] lg:flex-col lg:justify-center"
                }
              >
                <h3
                  className={`text-h3 font-bold transition-colors duration-300 ${
                    index === active ? "text-emerald" : "text-ink-muted"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-body text-ink-muted">
                  {step.body}
                </p>
                <div className="mt-6 lg:hidden">
                  <div className="rounded-md panel-surface p-4">
                    <Stage />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:col-span-7 lg:block">
            <div className="sticky top-24">
              <div className="flex min-h-[26rem] flex-col justify-center rounded-md panel-surface p-8">
                <div key={active} className="state-in">
                  <Stage />
                </div>
                <p className="mt-6 text-small text-ink-muted">
                  Contoh data workspace Ayu &amp; Budi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
