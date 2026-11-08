import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { PageSkeleton } from "@/components/app/skeleton";
import { TableScroll } from "@/components/app/table-scroll";
import { BUTTON_SMALL, LINK } from "@/components/app/ui";
import { BUTTON_PRIMARY } from "@/components/landing/ui";
import { jakartaDay } from "@/core/dashboard";
import { formatDate, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import { categories, members, user } from "@/lib/db/schema";
import {
  listTransactions,
  parseLedgerQuery,
  type LedgerFilter,
} from "@/lib/ledger/list";
import { requireWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardShell } from "../dashboard-nav";
import { BulkAttributeBar } from "./bulk-attribute-bar";
import { ExportButton } from "./export-button";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { TransactionActions } from "./transaction-actions";

export const metadata: Metadata = { title: "Transaksi" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function TransaksiPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <TransaksiContent searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * US-18/US-19: the ledger is a query, not a page of state. Filters and `?page=` are read
 * from the URL, `listTransactions` does the WHERE/ORDER/LIMIT in SQL (AGENTS §4) and the
 * page only renders rows. Row edit is the existing client leaf; bulk attribution is one
 * more (server-rendered rows, a form *outside* the table owning the checkboxes via `form`).
 */
async function TransaksiContent({ searchParams }: { searchParams: SearchParams }) {
  const workspace = await requireWorkspace();
  const db = getDb();
  const workspaceId = workspace.workspaceId;

  const { filters, page } = parseLedgerQuery(await searchParams);

  const [ledger, categoryRows, memberRows] = await Promise.all([
    listTransactions(db, workspaceId, filters, page),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.workspaceId, workspaceId))
      .orderBy(asc(categories.sort), asc(categories.name)),
    db
      .select({ userId: members.userId, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(desc(members.role)),
  ]);

  const memberOptions = memberRows.map((member) => ({
    id: member.userId,
    name: member.name,
  }));
  const hasFilters = Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.categoryId.length > 0 ||
      filters.memberId ||
      filters.direction ||
      filters.keyword,
  );
  const rangeStart = (ledger.page - 1) * ledger.pageSize + 1;
  const rangeEnd = rangeStart + ledger.rows.length - 1;
  // A hand-edited/shared URL can point past the last page: don't call that "no data".
  const outOfRange = ledger.total > 0 && ledger.rows.length === 0;

  return (
    <DashboardShell
      workspaceName={workspace.name}
      weddingDate={workspace.weddingDate}
      members={memberRows.map((member) => ({ userId: member.userId, name: member.name }))}
      active="transaksi"
    >
      <header className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">Transaksi</h1>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Semua mutasi dan pembayaran yang tercatat, terbaru dulu. Kategori dan
              anggotanya bisa diubah per baris, atau ditandai sekaligus untuk satu anggota.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManualEntryDialog
              workspaceId={workspaceId}
              today={jakartaDay(new Date())}
              categories={categoryRows}
              members={memberOptions}
            />
            <ExportButton workspaceId={workspaceId} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        <section aria-labelledby="filter-transaksi" className="panel-surface rounded-md p-6">
          <h2 id="filter-transaksi" className="text-h3 font-bold text-ink">
            Filter transaksi
          </h2>
          <p className="mt-1 text-small text-ink-muted">
            Filter tersimpan di alamat halaman — salin tautan atau tekan kembali tanpa
            kehilangan pilihan.
          </p>

          <form
            method="get"
            action="/dashboard/transaksi"
            role="search"
            aria-label="Filter transaksi"
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FilterField id="filter-dari" label="Dari tanggal">
              <input
                id="filter-dari"
                name="dateFrom"
                type="date"
                defaultValue={filters.dateFrom ?? ""}
                className={FILTER_CONTROL}
              />
            </FilterField>

            <FilterField id="filter-sampai" label="Sampai tanggal">
              <input
                id="filter-sampai"
                name="dateTo"
                type="date"
                defaultValue={filters.dateTo ?? ""}
                className={FILTER_CONTROL}
              />
            </FilterField>

            <FilterField id="filter-kategori" label="Kategori">
              <select
                id="filter-kategori"
                name="categoryId"
                defaultValue={filters.categoryId[0] ?? ""}
                className={FILTER_CONTROL}
              >
                <option value="">Semua kategori</option>
                {categoryRows.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField id="filter-anggota" label="Anggota">
              <select
                id="filter-anggota"
                name="memberId"
                defaultValue={filters.memberId ?? ""}
                className={FILTER_CONTROL}
              >
                <option value="">Semua anggota</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField id="filter-arah" label="Arah">
              <select
                id="filter-arah"
                name="direction"
                defaultValue={filters.direction ?? ""}
                className={FILTER_CONTROL}
              >
                <option value="">Masuk dan keluar</option>
                <option value="in">Uang masuk</option>
                <option value="out">Uang keluar</option>
              </select>
            </FilterField>

            <FilterField id="filter-kata" label="Cari deskripsi">
              <input
                id="filter-kata"
                name="keyword"
                type="search"
                autoComplete="off"
                placeholder="Misalnya: katering"
                defaultValue={filters.keyword ?? ""}
                className={FILTER_CONTROL}
              />
            </FilterField>

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
              <button type="submit" className={BUTTON_PRIMARY}>
                Terapkan filter
              </button>
              {hasFilters ? (
                <Link href="/dashboard/transaksi" className={`${LINK} text-small`}>
                  Hapus semua filter
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section aria-labelledby="daftar-transaksi" className="panel-surface rounded-md p-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 id="daftar-transaksi" className="text-h3 font-bold text-ink">
                Daftar transaksi
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                {outOfRange
                  ? "Halaman ini sudah lewat dari jumlah transaksi."
                  : ledger.total === 0
                    ? hasFilters
                      ? "Tidak ada transaksi yang cocok dengan filter."
                      : "Belum ada transaksi tercatat."
                    : `${rangeStart}–${rangeEnd} dari ${ledger.total} transaksi.`}
              </p>
            </div>

            <Pagination filters={filters} page={ledger.page} pageCount={ledger.pageCount} />
          </div>

          {outOfRange ? (
            <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
              <p className="text-small font-semibold text-ink">Halaman ini kosong.</p>
              <p className="mt-1 text-small text-ink-muted">
                Daftar transaksi berhenti di halaman {ledger.pageCount}.
              </p>
              <Link href={ledgerHref(filters, 1)} className={`${LINK} mt-3 inline-block text-small`}>
                Kembali ke halaman pertama
              </Link>
            </div>
          ) : ledger.rows.length === 0 ? (
            <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
              {hasFilters ? (
                <>
                  <p className="text-small font-semibold text-ink">
                    Tidak ada transaksi yang cocok.
                  </p>
                  <p className="mt-1 text-small text-ink-muted">
                    Longgarkan tanggal atau hapus kata kunci, lalu terapkan lagi.
                  </p>
                  <Link href="/dashboard/transaksi" className={`${LINK} mt-3 inline-block text-small`}>
                    Hapus semua filter
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-small font-semibold text-ink">
                    Belum ada transaksi — impor mutasi atau tambah transaksi manual.
                  </p>
                  <p className="mt-1 text-small text-ink-muted">
                    Mutasi rekening masuk lewat impor; pembayaran tunai atau dari rekening
                    lain bisa dicatat lewat tombol Tambah manual di kanan atas.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <BulkAttributeBar
                workspaceId={workspaceId}
                members={memberOptions}
                labels={Object.fromEntries(
                  ledger.rows.map((row) => [
                    row.id,
                    `${formatDate(row.occurredOn)} · ${row.description}`,
                  ]),
                )}
              />

              <TableScroll label="Tabel daftar transaksi" className="card-sheen mt-4 p-4">
                <table id="daftar-transaksi-tabel" className="w-full text-left text-small">
                  <caption className="sr-only">
                    Daftar transaksi, terbaru dulu. Pilih transaksi lewat kotak centang
                    untuk menandainya ke satu anggota, atau ubah kategori dan anggotanya per
                    baris.
                  </caption>
                  <thead>
                    <tr className="border-b border-rule text-ink-muted">
                      <th scope="col" className="pb-2 pr-3">
                        <span className="sr-only">Pilih</span>
                      </th>
                      <th scope="col" className="pb-2 pr-3 font-medium">
                        Tanggal
                      </th>
                      <th scope="col" className="pb-2 pr-3 font-medium">
                        Deskripsi
                      </th>
                      <th scope="col" className="hidden pb-2 pr-3 font-medium sm:table-cell">
                        Kategori
                      </th>
                      <th scope="col" className="pb-2 pr-3 font-medium">
                        Anggota
                      </th>
                      <th scope="col" className="hidden pb-2 pr-3 font-medium sm:table-cell">
                        Arah
                      </th>
                      <th scope="col" className="pb-2 pr-3 text-right font-medium">
                        Jumlah
                      </th>
                      <th scope="col" className="pb-2 pl-3 text-right font-medium">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {ledger.rows.map((row) => {
                      const amount = row.amountMinor;
                      const memberIndex = row.memberId
                        ? memberRows.findIndex((member) => member.userId === row.memberId)
                        : -1;
                      return (
                        <tr key={row.id}>
                          <td className="py-2.5 pr-3 align-middle">
                            <input
                              id={`pilih-${row.id}`}
                              type="checkbox"
                              name="ids"
                              value={row.id}
                              form="bulk-form"
                              aria-label={`Pilih transaksi ${row.description} tanggal ${formatDate(row.occurredOn)}`}
                              className="h-4 w-4 align-middle accent-emerald"
                            />
                          </td>
                          <th
                            scope="row"
                            className="whitespace-nowrap py-2.5 pr-3 text-left font-medium text-ink"
                          >
                            {formatDate(row.occurredOn)}
                          </th>
                          <td className="max-w-[24ch] py-2.5 pr-3">
                            <span className="block truncate text-ink">{row.description}</span>
                            <span className="block truncate text-small text-ink-muted sm:hidden">
                              {row.categoryName ?? "Tanpa kategori"}
                            </span>
                          </td>
                          <td className="hidden py-2.5 pr-3 text-ink-muted sm:table-cell">
                            {row.categoryName ?? "Tanpa kategori"}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-ink-muted">
                            {row.memberName ? (
                              <>
                                {memberIndex >= 0 ? (
                                  <span
                                    aria-hidden="true"
                                    className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                                      memberIndex === 0 ? "bg-emerald" : "bg-gold"
                                    }`}
                                  />
                                ) : null}
                                {row.memberName}
                              </>
                            ) : (
                              "Tanpa anggota"
                            )}
                          </td>
                          <td className="hidden py-2.5 pr-3 text-ink-muted sm:table-cell">
                            {row.direction === "in" ? "Masuk" : "Keluar"}
                          </td>
                          <td
                            className={`whitespace-nowrap py-2.5 pr-3 text-right font-semibold tabular-nums ${
                              amount > 0 ? "text-emerald" : "text-ink"
                            }`}
                          >
                            {amount > 0 ? `+${formatRupiah(amount)}` : formatRupiah(amount)}
                          </td>
                          <td className="py-2.5 pl-3">
                            <TransactionActions
                              workspaceId={workspaceId}
                              transaction={{
                                id: row.id,
                                occurredOn: row.occurredOn,
                                description: row.description,
                                amountMinor: amount,
                                direction: row.direction,
                                categoryId: row.categoryId,
                                memberId: row.memberId,
                                imported: row.imported,
                              }}
                              categories={categoryRows}
                              members={memberOptions}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            </>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}

const FILTER_CONTROL =
  "h-11 w-full rounded-sm border border-gold-line bg-surface px-3 text-body text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-emerald focus:ring-2 focus:ring-emerald/60";

/** Label + control; the id contract stays at the call site (`htmlFor`). */
function FilterField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-small font-bold text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Prev/next as real links; every filter is carried so page 2 is still "the same view". */
function Pagination({
  filters,
  page,
  pageCount,
}: {
  filters: LedgerFilter;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1 || page > pageCount) return null;

  return (
    <nav aria-label="Halaman transaksi" className="flex items-center gap-2">
      <PageLink href={ledgerHref(filters, page - 1)} disabled={page <= 1} label="Sebelumnya" />
      <span className="text-small tabular-nums text-ink-muted">
        {page} / {pageCount}
      </span>
      <PageLink
        href={ledgerHref(filters, page + 1)}
        disabled={page >= pageCount}
        label="Berikutnya"
      />
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${BUTTON_SMALL} pointer-events-none opacity-40`}>
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={BUTTON_SMALL}>
      {label}
    </Link>
  );
}

/** The URL for a filtered page — one builder, so no link can lose a filter. */
function ledgerHref(filters: LedgerFilter, page: number): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.categoryId.length > 0) params.set("categoryId", filters.categoryId.join(","));
  if (filters.memberId) params.set("memberId", filters.memberId);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/dashboard/transaksi?${query}` : "/dashboard/transaksi";
}
