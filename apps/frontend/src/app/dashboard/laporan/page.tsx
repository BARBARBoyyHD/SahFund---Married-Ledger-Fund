import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { PageSkeleton } from "@/components/app/skeleton";
import { toMinor } from "@/core/dashboard";
import { formatDate, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import { commitments, members, transactions, user } from "@/lib/db/schema";
import {
  contributionReport,
  type ContributionLine,
} from "@/lib/reports/contributions";
import { budgetVsActualReport } from "@/lib/reports/budget-vs-actual";
import { matchDuplicatePayments } from "@/lib/reports/duplicate-payments";
import { requireWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardShell } from "../dashboard-nav";
import { BudgetAction } from "./budget-action";

export const metadata: Metadata = { title: "Laporan" };

/**
 * US-25/US-27: the two aggregate reports. Both are read-only server components; every
 * figure comes from one SQL aggregate per report (AGENTS §4) and is rendered through
 * `src/core/money.ts`.
 *
 * No try/catch: a failed query throws into `../error.tsx` (RetryPanel), so a database
 * outage renders the error state with retry — never a table full of honest-looking zeros
 * (US-43, spec: DB failure shows error, not zeros).
 */
export default function LaporanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <LaporanContent />
    </Suspense>
  );
}

async function LaporanContent() {
  const workspace = await requireWorkspace();
  const db = getDb();
  const workspaceId = workspace.workspaceId;

  const [contributionLines, budget, memberRows, paymentRows] = await Promise.all([
    contributionReport(db, workspaceId),
    budgetVsActualReport(db, workspaceId),
    db
      .select({ userId: members.userId, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(desc(members.role)),
    db
      .select({
        id: commitments.id,
        vendor: commitments.vendor,
        paidMinor: commitments.paidMinor,
      })
      .from(commitments)
      .where(eq(commitments.workspaceId, workspaceId)),
  ]);

  /**
   * US-30. A commitment stores no payment date (only `total`, `paid`, `dueOn`), so the
   * matcher's date window is unbounded here and the comparison is equal-magnitude only —
   * a suggestion, never a merge. The ledger read is narrowed in SQL to the commitment
   * magnitudes (`inArray`, workspace-scoped), never the whole ledger; that set is bounded
   * by the contract list, not by ledger size.
   */
  const paidCommitments = paymentRows
    .map((row) => ({
      commitmentId: row.id,
      vendor: row.vendor,
      amountMinor: toMinor(row.paidMinor),
    }))
    .filter((row) => row.amountMinor > 0);
  const paidMagnitudes = [...new Set(paidCommitments.map((row) => row.amountMinor))];

  const ledgerRows =
    paidMagnitudes.length === 0
      ? []
      : await db
          .select({
            id: transactions.id,
            occurredOn: transactions.occurredOn,
            description: transactions.description,
            amountMinor: transactions.amountMinor,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.workspaceId, workspaceId),
              inArray(
                transactions.amountMinor,
                paidMagnitudes.map((amount) => BigInt(-amount)),
              ),
            ),
          );

  const duplicatePairs = matchDuplicatePayments(
    paidCommitments.map(({ commitmentId, amountMinor }) => ({
      commitmentId,
      // No stored payment date; ignored because the window below is unbounded.
      paidOn: "",
      amountMinor,
    })),
    ledgerRows.map((row) => ({
      transactionId: row.id,
      occurredOn: row.occurredOn,
      amountMinor: toMinor(row.amountMinor),
    })),
    Number.POSITIVE_INFINITY,
  );
  const vendorById = new Map(paidCommitments.map((row) => [row.commitmentId, row.vendor]));
  const transactionById = new Map(ledgerRows.map((row) => [row.id, row]));

  // A member with no rows still belongs in the report at Rp 0 — the query succeeded and
  // the zero is a fact. The unattributed group stays its own line, never folded in.
  const lineByMember = new Map(
    contributionLines
      .filter((line): line is ContributionLine & { memberId: string } => line.memberId !== null)
      .map((line) => [line.memberId, line]),
  );
  const lines = memberRows.map((member) => ({
    memberId: member.userId,
    name: member.name,
    inMinor: lineByMember.get(member.userId)?.inMinor ?? 0,
    outMinor: lineByMember.get(member.userId)?.outMinor ?? 0,
    netMinor: lineByMember.get(member.userId)?.netMinor ?? 0,
  }));
  const unattributed = contributionLines.find((line) => line.memberId === null) ?? null;

  const contributionTotals = {
    inMinor: contributionLines.reduce((total, line) => total + line.inMinor, 0),
    outMinor: contributionLines.reduce((total, line) => total + line.outMinor, 0),
    netMinor: contributionLines.reduce((total, line) => total + line.netMinor, 0),
  };
  const hasContributionData = contributionLines.length > 0;
  const weddingTargetMinor =
    workspace.budgetTargetMinor === null ? null : toMinor(workspace.budgetTargetMinor);

  return (
    <DashboardShell
      workspaceName={workspace.name}
      weddingDate={workspace.weddingDate}
      members={memberRows.map((member) => ({ userId: member.userId, name: member.name }))}
      active="laporan"
    >
      <header className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">Laporan</h1>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Siapa menyumbang berapa, dan pos mana yang sudah melewati anggaran. Semua
              angka dihitung dari mutasi dan komitmen yang tercatat.
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        <section aria-labelledby="kontribusi-judul" className="panel-surface rounded-md p-6">
          <h2 id="kontribusi-judul" className="text-h3 font-bold text-ink">
            Kontribusi per anggota
          </h2>
          <p className="mt-1 text-small text-ink-muted">
            Uang masuk, uang keluar, dan posisi bersih tiap anggota. Transaksi tanpa
            anggota dihitung terpisah.
          </p>

          {!hasContributionData ? (
            <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
              <p className="text-small font-semibold text-ink">Belum ada transaksi tercatat.</p>
              <p className="mt-1 text-small text-ink-muted">
                Impor mutasi rekening atau tambah transaksi manual; kontribusi tiap anggota
                muncul setelah nominalnya tercatat dan anggotanya ditandai.
              </p>
            </div>
          ) : (
            <div className="card-sheen mt-4 overflow-x-auto rounded-sm border border-gold/35 p-4">
              <table className="w-full text-left text-small">
                <caption className="sr-only">
                  Uang masuk, uang keluar, dan posisi bersih per anggota, dengan baris
                  transaksi tanpa anggota di bagian akhir
                </caption>
                <thead>
                  <tr className="border-b border-rule text-ink-muted">
                    <th scope="col" className="pb-2 pr-3 font-medium">
                      Anggota
                    </th>
                    <th scope="col" className="pb-2 pr-3 text-right font-medium">
                      Uang masuk
                    </th>
                    <th scope="col" className="pb-2 pr-3 text-right font-medium">
                      Uang keluar
                    </th>
                    <th scope="col" className="pb-2 pl-3 text-right font-medium">
                      Posisi bersih
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {lines.map((line) => (
                    <tr key={line.memberId}>
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                        {line.name}
                      </th>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink">
                        {formatRupiah(line.inMinor)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink">
                        {formatRupiah(line.outMinor)}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums ${
                          line.netMinor < 0 ? "text-danger" : "text-ink"
                        }`}
                      >
                        {formatRupiah(line.netMinor)}
                      </td>
                    </tr>
                  ))}

                  {unattributed ? (
                    <tr className="bg-emerald-soft/40">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                        Belum teratribusi
                        <span className="block text-small font-normal text-ink-muted">
                          Transaksi tanpa anggota — tidak digabung ke siapa pun
                        </span>
                      </th>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink">
                        {formatRupiah(unattributed.inMinor)}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-ink">
                        {formatRupiah(unattributed.outMinor)}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums ${
                          unattributed.netMinor < 0 ? "text-danger" : "text-ink"
                        }`}
                      >
                        {formatRupiah(unattributed.netMinor)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="border-t border-rule font-semibold text-ink">
                    <th scope="row" className="py-2.5 pr-3 text-left">
                      Total
                    </th>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                      {formatRupiah(contributionTotals.inMinor)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                      {formatRupiah(contributionTotals.outMinor)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums">
                      {formatRupiah(contributionTotals.netMinor)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="anggaran-laporan-judul" className="panel-surface rounded-md p-6">
          <h2 id="anggaran-laporan-judul" className="text-h3 font-bold text-ink">
            Anggaran vs realisasi
          </h2>
          <p className="mt-1 text-small text-ink-muted">
            Anggaran, komitmen vendor, yang sudah terbayar, dan sisanya per kategori.
            Kategori yang lewat anggaran ditandai, bukan dinolkan. Anggaran tiap pos bisa
            diatur langsung dari barisnya.
          </p>

          {budget.rows.length === 0 ? (
            <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
              <p className="text-small font-semibold text-ink">Belum ada kategori.</p>
              <p className="mt-1 text-small text-ink-muted">
                Kategori perhelatan disiapkan saat workspace dibuat. Setelah ada kategori
                dan anggaran, laporan ini menampilkan empat angka per pos.
              </p>
            </div>
          ) : (
            <div className="card-sheen mt-4 overflow-x-auto rounded-sm border border-gold/35 p-4">
              <table className="w-full text-left text-small">
                <caption className="sr-only">
                  Anggaran, komitmen, terbayar, dan sisa per kategori, dengan baris total
                  seluruh perhelatan dan tombol ubah anggaran di tiap baris kategori
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
                    <th scope="col" className="pb-2 pl-3 text-right font-medium">
                      Ubah
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
                        {row.name === null ? (
                          <span className="block text-small font-normal text-ink-muted">
                            Komitmen tanpa kategori
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
                        {remainingLabel(row.remainingMinor, row.overBudget)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {row.categoryId === null ? null : (
                          <BudgetAction
                            workspaceId={workspaceId}
                            categoryId={row.categoryId}
                            categoryName={row.name ?? "kategori"}
                            budgetMinor={row.budgetMinor}
                          />
                        )}
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
                      {remainingLabel(budget.totals.remainingMinor, budget.totals.overBudget)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="mt-3 text-small text-ink-muted">
            Target anggaran pernikahan, terpisah dari jumlah anggaran per kategori:{" "}
            <span className="font-semibold tabular-nums text-ink">
              {weddingTargetMinor === null ? "belum diatur" : formatRupiah(weddingTargetMinor)}
            </span>
            .
          </p>

          <p className="mt-3 text-small text-ink-muted">
            Sisa = anggaran − terbayar. Komitmen adalah nilai kontrak vendor yang belum
            tentu sudah keluar dari rekening. Kategori tanpa anggaran menampilkan “—”, bukan
            nol.
          </p>
        </section>

        {duplicatePairs.length === 0 ? null : (
          <section
            aria-labelledby="ganda-judul"
            className="panel-surface rounded-md border border-gold/40 p-6"
          >
            <h2 id="ganda-judul" className="text-h3 font-bold text-ink">
              Kemungkinan pembayaran ganda
            </h2>
            <p className="mt-1 max-w-[75ch] text-small text-ink-muted">
              Angka yang dihitung di total tabel anggaran adalah <strong>Terbayar dari
              komitmen</strong>. Transaksi mutasi yang cocok di bawah ini tidak ditambahkan
              ke kolom Terbayar, tetapi tetap terhitung sebagai uang keluar di laporan
              kontribusi dan saldo kas — jadi jangan menjumlahkan kedua laporan.
            </p>
            <p className="mt-2 max-w-[75ch] text-small text-ink-muted">
              Tidak ada angka yang digabung, diubah, atau dihapus otomatis. Kecocokan hanya
              melihat nominal yang sama (tanggal pembayaran komitmen tidak dicatat), jadi
              periksa dulu apakah keduanya memang pembayaran yang sama.
            </p>

            <ul className="mt-4 divide-y divide-rule border-t border-rule">
              {duplicatePairs.map((pair) => {
                const ledger = transactionById.get(pair.transactionId);
                return (
                  <li
                    key={`${pair.commitmentId}-${pair.transactionId}`}
                    className="py-3 text-small"
                  >
                    <p className="font-medium text-ink">
                      {vendorById.get(pair.commitmentId) ?? "Komitmen"}{" "}
                      <span className="whitespace-nowrap font-semibold tabular-nums">
                        {formatRupiah(pair.amountMinor)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-ink-muted">
                      Cocok dengan mutasi{" "}
                      {ledger ? (
                        <>
                          <span className="whitespace-nowrap tabular-nums">
                            {formatDate(ledger.occurredOn)}
                          </span>{" "}
                          · {ledger.description}
                        </>
                      ) : (
                        "di ledger"
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}

/**
 * Remaining is never clamped: an over-budget category reads "+Rp 500.000" in danger
 * colour (spec: Over-budget is visible).
 */
function remainingLabel(remainingMinor: number | null, overBudget: boolean): string {
  if (remainingMinor === null) return "—";
  return overBudget
    ? `+${formatRupiah(Math.abs(remainingMinor))}`
    : formatRupiah(remainingMinor);
}
