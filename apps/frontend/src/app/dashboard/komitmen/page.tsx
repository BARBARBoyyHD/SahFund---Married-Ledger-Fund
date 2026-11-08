import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { PageSkeleton } from "@/components/app/skeleton";
import { percent, toMinor } from "@/core/dashboard";
import { formatDate, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import { categories, commitments, members, user } from "@/lib/db/schema";
import { requireWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardShell } from "../dashboard-nav";
import { CommitmentActions, CommitmentSettlement } from "./commitment-actions";

export const metadata: Metadata = { title: "Komitmen" };

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  partial: "Sebagian",
  unpaid: "Belum dibayar",
};

/**
 * US-28/US-29: the full commitment list. Not paginated — vendor contracts per wedding
 * are a bounded set, and a silent `limit` would under-count the list it prints. Scoped
 * by the caller's workspace, category names joined in the same query — no N+1. Rows
 * without a due date stay visible, ordered last, so they never break the list.
 */
export default function KomitmenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <KomitmenContent />
    </Suspense>
  );
}

async function KomitmenContent() {
  const workspace = await requireWorkspace();
  const db = getDb();

  const [rows, categoryRows, memberRows] = await Promise.all([
    db
      .select({
        id: commitments.id,
        vendor: commitments.vendor,
        totalMinor: commitments.totalMinor,
        paidMinor: commitments.paidMinor,
        dueOn: commitments.dueOn,
        status: commitments.status,
        categoryName: categories.name,
      })
      .from(commitments)
      .leftJoin(categories, eq(commitments.categoryId, categories.id))
      .where(eq(commitments.workspaceId, workspace.workspaceId))
      .orderBy(asc(commitments.dueOn)),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.workspaceId, workspace.workspaceId))
      .orderBy(asc(categories.sort), asc(categories.name)),
    db
      .select({ userId: members.userId, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspace.workspaceId))
      .orderBy(desc(members.role)),
  ]);

  // SQLite sorts NULL first; US-29 wants dated contracts first, undated ones last.
  // A stable sort keeps the dueOn order the query already produced.
  const ordered = [...rows].sort(
    (a, b) => (a.dueOn === null ? 1 : 0) - (b.dueOn === null ? 1 : 0),
  );

  return (
    <DashboardShell
      workspaceName={workspace.name}
      weddingDate={workspace.weddingDate}
      members={memberRows}
      active="komitmen"
    >
      <header className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">Komitmen vendor</h1>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Kontrak vendor dan sisa pelunasan sampai hari H. Komitmen dihitung di forecast
              meski uangnya belum keluar. Catat DP dan pelunasan lewat tombol di tiap baris.
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        <section aria-labelledby="daftar-komitmen" className="panel-surface rounded-md p-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 id="daftar-komitmen" className="text-h3 font-bold text-ink">
                Daftar komitmen
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                {ordered.length === 0
                  ? "Belum ada kontrak vendor yang dicatat."
                  : `${ordered.length} kontrak tercatat.`}
              </p>
            </div>
            <CommitmentActions
              workspaceId={workspace.workspaceId}
              categories={categoryRows}
            />
          </div>

          {ordered.length === 0 ? (
            <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
              <p className="text-small text-ink-muted">
                Komitmen adalah kesepakatan dengan vendor — venue, katering, dekorasi —
                berisi total kontrak, DP yang sudah dibayar, dan jatuh tempo. Catat satu
                lewat tombol Tambah komitmen supaya sisa pelunasan ikut dihitung.
              </p>
            </div>
          ) : (
            <div className="card-sheen mt-4 rounded-sm border border-gold/35 px-4">
              <ul className="divide-y divide-rule">
                {ordered.map((row) => {
                  const total = toMinor(row.totalMinor);
                  const paid = toMinor(row.paidMinor);
                  const left = total - paid;
                  const paidInFull = left <= 0;
                  // Overpayment is stored as entered; never hidden or clamped away.
                  const overpaid = paid - total;
                  return (
                    <li key={row.id} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-small font-medium text-ink">{row.vendor}</p>
                          <p className="truncate text-small text-ink-muted">
                            {row.categoryName ?? "Tanpa kategori"} ·{" "}
                            {row.dueOn ? `tempo ${formatDate(row.dueOn)}` : "Tempo belum diatur"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-small font-semibold tabular-nums text-ink">
                            {formatRupiah(total)}
                          </p>
                          <p
                            className={`text-small tabular-nums ${
                              paidInFull ? "font-semibold text-emerald" : "text-ink-muted"
                            }`}
                          >
                            {STATUS_LABEL[row.status] ?? row.status}
                          </p>
                        </div>
                      </div>
                      <div
                        aria-hidden="true"
                        className="mt-2 h-1 overflow-hidden rounded-full bg-emerald-soft"
                      >
                        <div
                          className="h-full rounded-full bg-emerald"
                          style={{ width: `${Math.min(100, percent(paid, total))}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 text-small tabular-nums text-ink-muted">
                        <span>Terbayar {formatRupiah(paid)}</span>
                        <span className="flex flex-wrap items-center justify-end gap-3">
                          <span className={overpaid > 0 ? "font-semibold text-ink" : undefined}>
                            {overpaid > 0
                              ? `Lunas · lebih ${formatRupiah(overpaid)} dari total`
                              : paidInFull
                                ? "Lunas"
                                : `Sisa ${formatRupiah(left)}`}
                          </span>
                          <CommitmentSettlement
                            workspaceId={workspace.workspaceId}
                            commitment={{
                              id: row.id,
                              vendor: row.vendor,
                              totalMinor: total,
                              paidMinor: paid,
                              dueOn: row.dueOn,
                            }}
                          />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="mt-3 text-small text-ink-muted">
            Komitmen dengan jatuh tempo kosong tetap tersimpan dan tampil di sini.
          </p>
        </section>
      </main>
    </DashboardShell>
  );
}
