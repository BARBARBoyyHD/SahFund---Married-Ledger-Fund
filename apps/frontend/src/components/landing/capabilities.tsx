import type { ReactNode } from "react";

import { formatRupiah } from "@/core/money";
import { MemberChip } from "@/components/landing/member-chip";
import { Container, Section } from "@/components/landing/ui";
import { BUDGETS, CLOSING_MINOR, COMMITMENTS, FORECAST, ROWS } from "@/lib/landing-demo";

function Panel({
  title,
  body,
  className = "",
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      data-reveal
      className={`rounded-md bg-emerald-soft p-6 lg:p-8 ${className}`}
    >
      <h3 className="text-h3 font-bold text-ink">{title}</h3>
      <p className="mt-2 max-w-[42ch] text-body text-ink-muted">{body}</p>
      <div className="mt-6">{children}</div>
    </article>
  );
}

function LedgerSlice() {
  return (
    <div
      data-ui
      className="rounded-sm border border-gold bg-surface px-4 py-2"
    >
      {ROWS.map((row) => (
        <div
          key={`${row.on}-${row.label}`}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {row.member ? <MemberChip member={row.member} name={false} /> : null}
            <div className="min-w-0">
              <p className="truncate text-small font-semibold">{row.label}</p>
              <p className="text-small text-ink-muted">
                {row.on} · {row.category}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-small font-bold tabular-nums whitespace-nowrap">
            {formatRupiah(row.amountMinor)}
          </p>
        </div>
      ))}
    </div>
  );
}

function BudgetRows() {
  return (
    <div data-ui className="rounded-sm border border-gold bg-surface p-4">
      {BUDGETS.map((budget) => {
        const percent = Math.round(
          (budget.spentMinor / budget.budgetMinor) * 100,
        );
        return (
          <div key={budget.name} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-small font-semibold">{budget.name}</p>
              <p className="text-small font-bold tabular-nums text-emerald">
                {percent}%
              </p>
            </div>
            <p className="mt-0.5 text-small tabular-nums text-ink-muted">
              {formatRupiah(budget.spentMinor)} dari{" "}
              {formatRupiah(budget.budgetMinor)}
            </p>
            <div
              role="progressbar"
              aria-label={`${budget.name}: ${percent}% dari anggaran`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-soft"
            >
              <div
                className="h-2 rounded-full bg-emerald"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommitmentRows() {
  return (
    <div data-ui className="rounded-sm border border-gold bg-surface p-4">
      {COMMITMENTS.map((commitment) => (
        <div key={commitment.vendor} className="py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-small font-semibold">{commitment.vendor}</p>
            <p className="shrink-0 text-small text-ink-muted">
              {commitment.dueOn}
            </p>
          </div>
          <p className="mt-1 text-small tabular-nums text-ink-muted">
            DP {formatRupiah(commitment.paidMinor)} dari{" "}
            {formatRupiah(commitment.totalMinor)}
          </p>
          <p className="mt-0.5 text-small font-bold tabular-nums">
            Sisa {formatRupiah(commitment.totalMinor - commitment.paidMinor)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ShareSlice() {
  return (
    <div data-ui className="rounded-sm border border-gold bg-surface p-4">
      <p className="truncate rounded-xs bg-emerald-soft px-3 py-2.5 text-small font-semibold">
        sahund.id/r/ayu-budi-7k2
      </p>
      <dl className="mt-3 space-y-1 text-small">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Total terkumpul</dt>
          <dd className="font-semibold tabular-nums">
            {formatRupiah(CLOSING_MINOR)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Proyeksi hari H</dt>
          <dd className="font-semibold tabular-nums">
            Kurang {formatRupiah(FORECAST.shortfallAmountMinor)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-small text-ink-muted">
        Keterangan transaksi tidak ikut tampil.
      </p>
    </div>
  );
}

export function Capabilities() {
  return (
    <Section id="yang-dicatat">
      <Container>
        <h2 data-reveal className="text-h2 font-bold text-ink">
          Yang dicatat
        </h2>

        <div className="mt-8 grid gap-4 lg:mt-14 lg:grid-cols-12">
          <Panel
            title="Setiap rupiah punya pemilik"
            body="Setoran dan belanja membawa warna kontributornya. Terlihat siapa yang sudah setor lebih banyak tanpa dihitung ulang."
            className="lg:col-span-7"
          >
            <LedgerSlice />
          </Panel>

          <Panel
            title="Anggaran per kategori"
            body="Kategori pernikahan sudah terisi saat workspace dibuat. Sisa tiap kategori dihitung dari transaksi yang masuk."
            className="lg:col-span-5"
          >
            <BudgetRows />
          </Panel>

          <Panel
            title="Komitmen vendor"
            body="Nilai kontrak, DP yang sudah dibayar, dan tanggal pelunasan. Yang belum lunas ikut dihitung di proyeksi."
            className="lg:col-span-5"
          >
            <CommitmentRows />
          </Panel>

          <Panel
            title="Satu tautan untuk keluarga"
            body="Laporan hanya-baca untuk orang tua atau wedding organizer, tanpa memberi mereka akses ke catatan kalian."
            className="lg:col-span-7"
          >
            <ShareSlice />
          </Panel>
        </div>
      </Container>
    </Section>
  );
}
