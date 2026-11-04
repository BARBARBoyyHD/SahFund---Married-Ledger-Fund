import { Container, Section } from "@/components/landing/ui";

const QUESTIONS = [
  {
    question: "Apakah berkas mutasi saya diunggah?",
    answer:
      "Tidak. PDF mutasi dibaca di perangkat kalian; yang dikirim ke server hanya baris transaksi yang sudah dinormalisasi. Tidak ada dokumen atau gambar yang disimpan.",
  },
  {
    question: "Bank apa saja yang didukung?",
    answer:
      "Bank Jago lewat PDF, dan bank lain lewat ekspor CSV atau Excel dengan pemetaan kolom. Mutasi hasil pindai atau foto belum didukung.",
  },
  {
    question: "Apakah ini langganan?",
    answer:
      "Bukan. Sekali bayar per pernikahan: Rp 49.000 harga perkenalan, Rp 99.000 setelahnya. Tidak ada tagihan berulang dan tidak ada biaya per anggota.",
  },
  {
    question: "Bagaimana kalau saldonya tidak cocok?",
    answer:
      "Impor tetap tersimpan, ditandai belum cocok, dan tidak dihitung ke total sampai selisihnya diselesaikan. Jumlah selisihnya ditampilkan di halaman impor.",
  },
  {
    question: "Bisa dipakai berdua?",
    answer:
      "Satu workspace untuk dua orang. Pasangan kedua masuk lewat kode saku atau undangan email, dan setiap transaksi membawa warna kontributornya.",
  },
  {
    question: "Setelah hari H, data saya bagaimana?",
    answer:
      "Catatan tetap bisa dibaca dan diekspor. Pemilik workspace bisa menghapus workspace kapan saja; barisnya dihapus seketika dan dibersihkan dari cadangan dalam 30 hari.",
  },
];

export function Faq() {
  return (
    <Section id="pertanyaan">
      <Container>
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h2
              data-reveal
              className="text-h2 font-bold text-ink lg:sticky lg:top-24"
            >
              Pertanyaan
            </h2>
          </div>

          <div className="mt-8 space-y-2 lg:col-span-8 lg:mt-0">
            {QUESTIONS.map((item) => (
              <details
                key={item.question}
                name="faq"
                data-reveal
                className="group rounded-sm border border-gold bg-surface transition-colors duration-200 open:border-emerald open:bg-emerald"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 text-h3 font-bold text-ink [&::-webkit-details-marker]:hidden group-open:text-pearl">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="relative h-4 w-4 shrink-0"
                  >
                    <span className="absolute left-0 top-1/2 h-[3px] w-4 -translate-y-1/2 rounded-full bg-emerald group-open:bg-gold" />
                    <span className="absolute left-1/2 top-0 h-4 w-[3px] -translate-x-1/2 rounded-full bg-emerald transition-transform duration-200 group-open:rotate-90 group-open:bg-gold" />
                  </span>
                </summary>
                <p className="max-w-[58ch] px-5 pb-6 text-body text-ink-muted group-open:text-pearl-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
