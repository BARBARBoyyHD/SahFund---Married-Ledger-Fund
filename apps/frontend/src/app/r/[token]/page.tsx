import { and, eq, gt, gte, lt, lte, sum } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { PageSkeleton } from "@/components/app/skeleton";
import { LINK } from "@/components/app/ui";
import { Container } from "@/components/landing/ui";
import { Wordmark } from "@/components/mark";
import { jakartaDay, monthBounds, toMinor } from "@/core/dashboard";
import { forecast } from "@/core/forecast";
import { formatDate, formatRemaining, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import { commitments, transactions, workspaces } from "@/lib/db/schema";
import { trustedTotalsCondition } from "@/lib/ledger/trusted";
import { budgetVsActualReport } from "@/lib/reports/budget-vs-actual";
import { resolveShareToken } from "@/lib/share/resolve-token";

export const metadata: Metadata = {
  title: "Laporan dibagikan",
  // A capability URL is private by design; never let a crawler index it.
  robots: { index: false, follow: false },
};

/**
 * US-33 / BRD FR-11: the public, read-only shared report. No session anywhere on this
 * route and no mutation controls. Every query is an aggregate scoped to the workspace the
 * token resolved to — no `transactions.description`, no member rows, no row ids. A token
 * that is unknown, expired or revoked renders the same clear unavailable page.
 */
export default function ShareReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-surface text-ink">
          <PageSkeleton />
        </div>
      }
    >
      <ShareReport params={params} />
    </Suspense>
  );
}

async function ShareReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // The token read and the "now" that decides expiry must happen at request time, not
  // during the static shell prerender (`connection()` is the dynamic boundary).
  await connection();
  const db = getDb();
  const now = new Date();
  const workspaceId = await resolveShareToken(db, token, now);
  if (!workspaceId) return <ShareUnavailable />;

  const [workspace] = await db
    .select({
      name: workspaces.name,
      weddingDate: workspaces.weddingDate,
      budgetTargetMinor: workspaces.budgetTargetMinor,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // The token's workspace is gone (deleted between resolve and read): same message.
  if (!workspace) return <ShareUnavailable />;

  const todayIso = jakartaDay(now);
  const { lastStart, lastEnd } = monthBounds(todayIso);
  // US-17 AC3: a flagged import never enters a shared total before confirmation.
  const trusted = await trustedTotalsCondition(db, workspaceId);

  const [budget, balanceRows, unpaidRows, spentRows, lastInRows] = await Promise.all([
    budgetVsActualReport(db, workspaceId),
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(eq(transactions.workspaceId, workspaceId), trusted)),
    db
      .select({ total: sum(commitments.totalMinor), paid: sum(commitments.paidMinor) })
      .from(commitments)
      .where(
        and(
          eq(commitments.workspaceId, workspaceId),
          lt(commitments.paidMinor, commitments.totalMinor),
        ),
      ),
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          lt(transactions.amountMinor, BigInt(0)),
          trusted,
        ),
      ),
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          gt(transactions.amountMinor, BigInt(0)),
          gte(transactions.occurredOn, lastStart),
          lte(transactions.occurredOn, lastEnd),
          trusted,
        ),
      ),
  ]);

  const balanceMinor = toMinor(balanceRows[0]?.total);
  const committedUnpaidMinor = Math.max(
    0,
    toMinor(unpaidRows[0]?.total) - toMinor(unpaidRows[0]?.paid),
  );
  const spentMinor = Math.abs(toMinor(spentRows[0]?.total));
  const lastMonthInflowMinor = toMinor(lastInRows[0]?.total);
  const budgetTargetMinor =
    workspace.budgetTargetMinor === null ? null : toMinor(workspace.budgetTargetMinor);
  const remainingBudgetMinor =
    budgetTargetMinor === null ? 0 : Math.max(0, budgetTargetMinor - spentMinor);

  const hasData =
    budget.rows.length > 0 ||
    balanceMinor !== 0 ||
    spentMinor !== 0 ||
    committedUnpaidMinor !== 0;

  return (
    <ShareShell>
      <Container className="pt-10 pb-16 lg:pt-14">
        <header className="max-w-[62ch]">
          <p className="text-eyebrow font-bold uppercase tracking-[0.08em] text-ink-muted">
            Laporan dibagikan
          </p>
          <h1 className="mt-2 text-h2 font-extrabold text-ink">
            Dana pernikahan {workspace.name}
          </h1>
          <p className="mt-2 text-small text-ink-muted">
            Ringkasan per {formatDate(todayIso)}. Halaman ini hanya menampilkan angka
            gabungan — rincian transaksi dan data anggota tidak dibagikan.
          </p>
        </header>

        {!hasData ? (
          <div className="mt-8 rounded-sm border border-dashed border-gold/40 px-4 py-8">
            <h2 className="text-h3 font-bold text-ink">Belum ada data untuk dibagikan.</h2>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Pemilik workspace belum mencatat transaksi atau anggaran. Ringkasan akan muncul
              di sini setelah datanya ada.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-4">
            <section aria-labelledby="ringkasan-judul" className="panel-surface rounded-md p-6">
              <h2 id="ringkasan-judul" className="text-h3 font-bold text-ink">
                Ringkasan dana
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-sheen rounded-sm border border-gold/35 p-4">
                  <dt className="text-small text-ink-muted">Saldo dana</dt>
                  <dd className="mt-1 text-h3 font-bold tabular-nums text-ink">
                    {formatRupiah(balanceMinor)}
                  </dd>
                </div>
                <div className="card-sheen rounded-sm border border-gold/35 p-4">
                  <dt className="text-small text-ink-muted">Total uang keluar</dt>
                  <dd className="mt-1 text-h3 font-bold tabular-nums text-ink">
                    {formatRupiah(spentMinor)}
                  </dd>
                </div>
                <div className="card-sheen rounded-sm border border-gold/35 p-4">
                  <dt className="text-small text-ink-muted">Komitmen belum terbayar</dt>
                  <dd className="mt-1 text-h3 font-bold tabular-nums text-ink">
                    {formatRupiah(committedUnpaidMinor)}
                  </dd>
                </div>
                <div className="card-sheen rounded-sm border border-gold/35 p-4">
                  <dt className="text-small text-ink-muted">Target anggaran</dt>
                  <dd className="mt-1 text-h3 font-bold tabular-nums text-ink">
                    {budgetTargetMinor === null ? "Belum diatur" : formatRupiah(budgetTargetMinor)}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="kategori-judul" className="panel-surface rounded-md p-6">
              <h2 id="kategori-judul" className="text-h3 font-bold text-ink">
                Anggaran per kategori
              </h2>
              <p className="mt-1 max-w-[75ch] text-small text-ink-muted">
                Anggaran, nilai komitmen vendor, yang sudah terbayar, dan sisanya. Kategori
                yang lewat anggaran ditandai, bukan dinolkan.
              </p>

              {budget.rows.length === 0 ? (
                <p className="mt-4 text-small text-ink-muted">
                  Belum ada kategori atau anggaran yang dicatat.
                </p>
              ) : (
                <div className="card-sheen mt-4 overflow-x-auto rounded-sm border border-gold/35 p-4">
                  <table className="w-full text-left text-small">
                    <caption className="sr-only">
                      Anggaran, komitmen, terbayar, dan sisa per kategori, dengan baris total
                    </caption>
                    <thead>
                      <tr className="border-b border-rule text-ink-muted">
                        <th scope="col" className="pb-2 pr-3 font-medium">
                          Kategori
                        </th>
                        <th
                          scope="col"
                          className="hidden pb-2 pr-3 text-right font-medium sm:table-cell"
                        >
                          Anggaran
                        </th>
                        <th
                          scope="col"
                          className="hidden pb-2 pr-3 text-right font-medium sm:table-cell"
                        >
                          Komitmen
                        </th>
                        <th scope="col" className="pb-2 pr-3 text-right font-medium">
                          Terbayar
                        </th>
                        <th scope="col" className="pb-2 pl-3 text-right font-medium">
                          Sisa
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {budget.rows.map((row) => (
                        <tr key={row.categoryId ?? "tanpa-kategori"}>
                          <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                            {row.name ?? "Belum kategori"}
                            {row.overBudget ? (
                              <span className="ml-2 inline-block rounded-full bg-danger/10 px-2 py-0.5 align-middle text-xs font-bold text-danger">
                                Lewat anggaran
                              </span>
                            ) : null}
                          </th>
                          <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink sm:table-cell">
                            {row.budgetMinor === null ? "—" : formatRupiah(row.budgetMinor)}
                          </td>
                          <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink sm:table-cell">
                            {formatRupiah(row.committedMinor)}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink">
                            {formatRupiah(row.paidMinor)}
                          </td>
                          <td
                            className={`whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums ${
                              row.overBudget ? "text-danger" : "text-ink"
                            }`}
                          >
                            {formatRemaining(row.remainingMinor, row.overBudget)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-rule font-semibold text-ink">
                        <th scope="row" className="py-2.5 pr-3 text-left">
                          Total
                        </th>
                        <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right tabular-nums sm:table-cell">
                          {formatRupiah(budget.totals.budgetMinor)}
                        </td>
                        <td className="hidden whitespace-nowrap py-2.5 pr-3 text-right tabular-nums sm:table-cell">
                          {formatRupiah(budget.totals.committedMinor)}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                          {formatRupiah(budget.totals.paidMinor)}
                        </td>
                        <td
                          className={`whitespace-nowrap py-2.5 pl-3 text-right tabular-nums ${
                            budget.totals.overBudget ? "text-danger" : "text-ink"
                          }`}
                        >
                          {formatRemaining(budget.totals.remainingMinor, budget.totals.overBudget)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <ForecastSection
              workspaceName={workspace.name}
              weddingDate={workspace.weddingDate}
              todayIso={todayIso}
              balanceMinor={balanceMinor}
              committedUnpaidMinor={committedUnpaidMinor}
              remainingBudgetMinor={remainingBudgetMinor}
              budgetTargetMinor={budgetTargetMinor}
              lastMonthInflowMinor={lastMonthInflowMinor}
            />
          </div>
        )}

        <p className="mt-8 max-w-[75ch] border-t border-rule pt-4 text-small text-ink-muted">
          Laporan ini hanya berisi ringkasan angka. Tautan tidak bisa mengubah data, dan
          pemilik workspace bisa mencabutnya kapan saja.
        </p>
      </Container>
    </ShareShell>
  );
}

/**
 * The one `forecast()` implementation, fed the same server-side inputs the dashboard
 * uses. Read-only: the planned monthly deposit is last month's inflow (stated in the
 * copy) rather than a simulator input, because the shared page has no controls.
 */
function ForecastSection({
  workspaceName,
  weddingDate,
  todayIso,
  balanceMinor,
  committedUnpaidMinor,
  remainingBudgetMinor,
  budgetTargetMinor,
  lastMonthInflowMinor,
}: {
  workspaceName: string;
  weddingDate: string | null;
  todayIso: string;
  balanceMinor: number;
  committedUnpaidMinor: number;
  remainingBudgetMinor: number;
  budgetTargetMinor: number | null;
  lastMonthInflowMinor: number;
}) {
  const pastDate = weddingDate !== null && weddingDate < todayIso;

  if (weddingDate === null) {
    return (
      <ForecastNotice title="Tanggal pernikahan belum diatur">
        Forecast butuh tanggal hari H. Ringkasan dana di atas tetap berlaku; forecast muncul
        setelah pemilik workspace mengisi tanggalnya.
      </ForecastNotice>
    );
  }

  if (pastDate) {
    return (
      <ForecastNotice title="Tanggal pernikahan sudah lewat">
        Tanggal yang tercatat adalah {formatDate(weddingDate)}, jadi forecast tidak dihitung.
        Ringkasan dana di atas tetap berlaku.
      </ForecastNotice>
    );
  }

  if (budgetTargetMinor === null) {
    return (
      <ForecastNotice title="Target anggaran belum diatur">
        Forecast butuh target anggaran untuk menghitung sisa kebutuhan. Ringkasan dana di
        atas tetap berlaku; forecast muncul setelah pemilik workspace mengisi targetnya.
      </ForecastNotice>
    );
  }

  const result = forecast({
    balanceMinor,
    committedUnpaidMinor,
    remainingBudgetMinor,
    plannedMonthlyDepositMinor: lastMonthInflowMinor,
    weddingDate: new Date(`${weddingDate}T00:00:00Z`),
    today: new Date(`${todayIso}T00:00:00Z`),
  });
  const surplusMinor = Math.max(0, result.projectedMinor - result.needMinor);

  return (
    <section aria-labelledby="forecast-judul" className="panel-surface rounded-md p-6">
      <h2 id="forecast-judul" className="text-h3 font-bold text-ink">
        Forecast sampai hari H
      </h2>
      <p className="mt-1 max-w-[75ch] text-small text-ink-muted">
        Dihitung dari saldo, komitmen yang belum terbayar, dan sisa target anggaran.
      </p>

      <div className="card-sheen mt-4 rounded-sm border border-gold/35 p-5">
        <p className="text-body font-semibold text-ink">
          {result.status === "funded" ? (
            <>
              Dana {workspaceName} cukup sampai {formatDate(weddingDate)} — estimasi surplus{" "}
              <span className="whitespace-nowrap tabular-nums">{formatRupiah(surplusMinor)}</span>.
            </>
          ) : (
            <>
              Masih kurang{" "}
              <span className="whitespace-nowrap tabular-nums">
                {formatRupiah(result.shortfallAmountMinor)}
              </span>{" "}
              sampai {formatDate(weddingDate)}.
            </>
          )}
        </p>

        <p className="mt-4 text-h3 font-bold tabular-nums text-ink">
          {formatRupiah(result.requiredMonthlyDepositMinor)}
          <span className="ml-2 text-small font-normal text-ink-muted">/ bulan</span>
        </p>
        <p className="mt-1 text-small text-ink-muted">
          {result.requiredMonthlyDepositMinor > 0
            ? "Sisihkan jumlah ini tiap bulan supaya kebutuhan sampai hari H terpenuhi."
            : "Tidak perlu menambah tabungan bulanan dengan rencana setoran ini."}
        </p>
        <p className="mt-4 text-small text-ink-muted">
          Asumsi setoran bulanan sama dengan uang masuk bulan lalu (
          {formatRupiah(lastMonthInflowMinor)}), dengan {result.monthsLeft} bulan tersisa.
        </p>
      </div>
    </section>
  );
}

function ForecastNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="forecast-catatan-judul" className="panel-surface rounded-md p-6">
      <h2 id="forecast-catatan-judul" className="text-h3 font-bold text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-[62ch] text-small text-ink-muted">{children}</p>
    </section>
  );
}

/** Unknown, expired and revoked tokens all land here — one clear message, no details. */
function ShareUnavailable() {
  return (
    <ShareShell>
      <Container className="py-16 lg:py-24">
        <div className="max-w-[52ch]">
          <p className="text-eyebrow font-bold uppercase tracking-[0.08em] text-ink-muted">
            Tautan laporan
          </p>
          <h1 className="mt-3 text-h2 font-extrabold text-ink">
            Tautan tidak tersedia atau sudah kedaluwarsa
          </h1>
          <p className="mt-4 text-body text-ink-muted">
            Tautan ini sudah tidak berlaku — mungkin masa berlakunya habis atau pemilik
            workspace mencabutnya. Minta pemilik membuat tautan baru.
          </p>
          <Link href="/" className={`${LINK} mt-6 inline-block`}>
            Kembali ke beranda
          </Link>
        </div>
      </Container>
    </ShareShell>
  );
}

function ShareShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-surface text-ink [--focus-ring:var(--color-emerald)]">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-ink"
      >
        Lewati ke konten
      </a>
      <header className="border-b border-gold/35 bg-pearl">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="rounded-xs" aria-label="SahFund — beranda">
            <Wordmark />
          </Link>
          <span className="text-small text-ink-muted">Laporan dibagikan</span>
        </Container>
      </header>
      <main id="konten">{children}</main>
    </div>
  );
}
