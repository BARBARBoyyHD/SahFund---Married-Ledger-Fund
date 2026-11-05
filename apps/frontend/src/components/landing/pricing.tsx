import Link from "next/link";

import { formatRupiah, rupiahToMinor } from "@/core/money";
import { Container, Eyebrow, Section, BUTTON_SECONDARY } from "@/components/landing/ui";

const INCLUDED = [
  "Impor tanpa batas untuk satu pernikahan",
  "Ekspor catatan ke CSV",
  "Tautan laporan untuk keluarga",
  "Dua orang dalam satu workspace",
];

export function Pricing() {
  return (
    <Section id="harga">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-12">
          <div data-reveal className="lg:col-span-4">
            <Eyebrow>Harga</Eyebrow>
            <h2 className="mt-4 text-h2 font-bold text-ink">Satu kali bayar</h2>
            <p className="mt-4 max-w-[34ch] text-body text-ink-muted">
              Sekali per pernikahan, bukan langganan. Pekerjaannya memang selesai
              di hari H.
            </p>
          </div>

          <div
            data-reveal
            className="border-t border-gold pt-8 lg:col-span-7 lg:col-start-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12"
          >
            <p className="text-figure font-extrabold tabular-nums text-emerald">
              {formatRupiah(rupiahToMinor(49_000))}
            </p>
            <p className="mt-3 text-body text-ink-muted">
              Harga perkenalan. Setelahnya{" "}
              {formatRupiah(rupiahToMinor(99_000))} — tetap sekali bayar.
            </p>

            <ul className="mt-8 space-y-2 text-body">
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <Link href="/login" className={`${BUTTON_SECONDARY} mt-8`}>
              Buat akun
            </Link>
            <p className="mt-4 text-small text-ink-muted">
              Satu impor gratis sebelum membayar. Tidak ada tagihan berulang.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
