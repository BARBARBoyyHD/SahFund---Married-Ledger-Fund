"use client";

import { useState } from "react";

import { forecast } from "@/core/forecast";
import { formatDate, formatRupiah, parseRupiahInput, rupiahToMinor } from "@/core/money";
import { INPUT } from "@/components/landing/ui";

/**
 * US-31 / BRD FR-10: the simulator. It imports the one `forecast()` implementation and
 * re-runs it on every keystroke — the math is never re-implemented here. The server has
 * already computed balance, unpaid commitments and remaining budget from D1; only the
 * planned monthly deposit is user-controlled (it has no database column).
 */
export function ForecastSimulator({
  weddingDate,
  today,
  balanceMinor,
  committedUnpaidMinor,
  remainingBudgetMinor,
  defaultMonthlyMinor,
}: {
  weddingDate: string;
  today: string;
  balanceMinor: number;
  committedUnpaidMinor: number;
  remainingBudgetMinor: number;
  defaultMonthlyMinor: number;
}) {
  const [depositText, setDepositText] = useState(() => formatRupiah(defaultMonthlyMinor));

  const parsed = parseRupiahInput(depositText);
  const invalid = depositText.trim() !== "" && parsed === null;
  const plannedMonthlyMinor = rupiahToMinor(parsed ?? 0);

  const result = forecast({
    balanceMinor,
    committedUnpaidMinor,
    remainingBudgetMinor,
    plannedMonthlyDepositMinor: plannedMonthlyMinor,
    weddingDate: new Date(`${weddingDate}T00:00:00Z`),
    today: new Date(`${today}T00:00:00Z`),
  });

  const surplusMinor = Math.max(0, result.projectedMinor - result.needMinor);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="hasil-judul"
        aria-live="polite"
        className="hero-field rounded-md p-6 shadow-card [--focus-ring:var(--color-gold)] sm:p-8"
      >
        <h2
          id="hasil-judul"
          className="flex items-center gap-3 text-eyebrow font-bold uppercase tracking-[0.08em] text-gold"
        >
          <span aria-hidden="true" className="h-px w-6 shrink-0 bg-gold" />
          Hasil forecast
        </h2>

        <p className="mt-3 max-w-[52ch] text-body font-semibold text-pearl">
          {result.status === "funded" ? (
            <>
              Dana kalian cukup sampai {formatDate(weddingDate)} — estimasi surplus{" "}
              <span className="tabular-nums text-gold">{formatRupiah(surplusMinor)}</span>.
            </>
          ) : (
            <>
              Masih kurang{" "}
              <span className="tabular-nums text-gold">
                {formatRupiah(result.shortfallAmountMinor)}
              </span>{" "}
              sampai {formatDate(weddingDate)}.
            </>
          )}
        </p>

        <p className="mt-4 text-total font-extrabold tabular-nums text-pearl">
          {formatRupiah(result.requiredMonthlyDepositMinor)}
          <span className="ml-2 text-small font-normal text-pearl-muted">/ bulan</span>
        </p>
        <p className="mt-2 text-small text-pearl-muted">
          {result.requiredMonthlyDepositMinor > 0
            ? "Sisihkan jumlah ini tiap bulan supaya kebutuhan sampai hari H terpenuhi."
            : "Tidak perlu menambah tabungan bulanan dengan rencana setoran ini."}
        </p>
      </section>

      <section aria-labelledby="simulasi-judul" className="panel-surface rounded-md p-6">
        <h2 id="simulasi-judul" className="text-h3 font-bold text-ink">
          Simulasi setoran bulanan
        </h2>
        <p className="mt-1 text-small text-ink-muted">
          Ubah rencana tabungan dan hasilnya dihitung ulang langsung.
        </p>

        <div className="card-sheen mt-4 rounded-sm border border-gold/35 p-4 sm:p-5">
          <label htmlFor="setoran-bulanan" className="block text-small font-bold text-ink">
            Rencana tabungan per bulan
          </label>
          <input
            id="setoran-bulanan"
            name="setoranBulanan"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={depositText}
            onChange={(event) => setDepositText(event.target.value)}
            aria-invalid={invalid}
            aria-describedby="setoran-bulanan-hint"
            className={`${INPUT} mt-2 border-gold-line focus:border-emerald`}
          />
          <p id="setoran-bulanan-hint" className="mt-1.5 text-small text-ink-muted">
            Nilai awal diambil dari uang masuk bulan lalu. Tulis angka rupiah, misalnya
            5.000.000.
          </p>
          {invalid ? (
            <p className="mt-1.5 text-small text-danger" role="status">
              Nominal belum terbaca — simulasi memakai Rp 0.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="rincian-judul" className="panel-surface rounded-md p-6">
        <h2 id="rincian-judul" className="text-h3 font-bold text-ink">
          Angka yang dipakai
        </h2>
        <p className="mt-1 text-small text-ink-muted">
          Saldo dan komitmen dibaca dari catatan kalian, bukan perkiraan.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card-sheen rounded-sm border border-gold/35 p-4">
            <dt className="text-small text-ink-muted">Saldo tercatat</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {formatRupiah(balanceMinor)}
            </dd>
          </div>
          <div className="card-sheen rounded-sm border border-gold/35 p-4">
            <dt className="text-small text-ink-muted">Komitmen belum lunas</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {formatRupiah(committedUnpaidMinor)}
            </dd>
          </div>
          <div className="card-sheen rounded-sm border border-gold/35 p-4">
            <dt className="text-small text-ink-muted">Sisa anggaran</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {formatRupiah(remainingBudgetMinor)}
            </dd>
            <p className="mt-1 text-small text-ink-muted">Target anggaran dikurangi realisasi.</p>
          </div>
          <div className="card-sheen rounded-sm border border-gold/35 p-4">
            <dt className="text-small text-ink-muted">Bulan tersisa</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-ink">
              {result.monthsLeft} bulan
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
