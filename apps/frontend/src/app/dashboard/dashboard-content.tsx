import { and, asc, count, desc, eq, gt, gte, lt, lte, sum } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { SignOutButton } from "@/components/app/sign-out-button";
import { LINK } from "@/components/app/ui";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Container, Eyebrow } from "@/components/landing/ui";
import {
  daysUntil,
  jakartaDay,
  monthBounds,
  perMember,
  percent,
  percentChange,
  toMinor,
} from "@/core/dashboard";
import { forecast } from "@/core/forecast";
import { formatDate, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import {
  categories,
  commitments,
  imports,
  members,
  transactions,
  user,
} from "@/lib/db/schema";
import { trustedTotalsCondition } from "@/lib/ledger/trusted";
import { requireSession } from "@/lib/session";
import { readWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardActions } from "./dashboard-dialogs";
import { DashboardMobileNav, DashboardSidebar } from "./dashboard-nav";

/**
 * The dashboard (design D11 revised): one page per user, read-only for now. Every
 * number comes from D1 scoped by the caller's own membership row (AGENTS §4); the
 * screen has no hand-rolled client cache and no `useEffect` fetching. `page.tsx`'s
 * `<Suspense>` boundary owns the loading state, `error.tsx` the retry state.
 */
export async function DashboardContent() {
  const session = await requireSession();
  const db = getDb();
  const todayIso = jakartaDay(new Date());
  // The caller's own membership → workspace row; null keeps the create/join prompt.
  const account = await readWorkspace(session.user.id);

  if (!account) return <NoWorkspace name={session.user.name} />;

  const workspaceId = account.workspaceId;
  const { thisStart, thisEnd, lastStart, lastEnd } = monthBounds(todayIso);
  // US-17: flagged-but-unconfirmed imports stay out of every total below.
  const trusted = await trustedTotalsCondition(db, workspaceId);

  const [
    memberRows,
    totalsRows,
    thisInRows,
    thisOutRows,
    lastInRows,
    contributionRows,
    recent,
    budgetRows,
    commitmentRows,
    importRows,
  ] = await Promise.all([
    db
      .select({ userId: members.userId, role: members.role, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(desc(members.role)),
    db
      .select({ txCount: count(), balance: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(eq(transactions.workspaceId, workspaceId), trusted)),
    // Each figure is one indexed aggregate (AGENTS §4); the month bounds are app-side
    // text (rule P6) and the query builder keeps the dialect in schema.ts (rule P1).
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          gt(transactions.amountMinor, BigInt(0)),
          gte(transactions.occurredOn, thisStart),
          lte(transactions.occurredOn, thisEnd),
          trusted,
        ),
      ),
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          lt(transactions.amountMinor, BigInt(0)),
          gte(transactions.occurredOn, thisStart),
          lte(transactions.occurredOn, thisEnd),
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
    db
      .select({
        memberId: transactions.memberId,
        total: sum(transactions.amountMinor),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          gt(transactions.amountMinor, BigInt(0)),
          trusted,
        ),
      )
      .groupBy(transactions.memberId),
    db
      .select({
        id: transactions.id,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        occurredOn: transactions.occurredOn,
        memberId: transactions.memberId,
        memberName: user.name,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(members, eq(transactions.memberId, members.userId))
      .leftJoin(user, eq(members.userId, user.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.workspaceId, workspaceId))
      .orderBy(desc(transactions.occurredOn), desc(transactions.id))
      .limit(5),
    db
      .select({
        id: categories.id,
        name: categories.name,
        budgetMinor: categories.budgetMinor,
        spent: sum(transactions.amountMinor),
      })
      .from(categories)
      .leftJoin(
        transactions,
        and(
          eq(transactions.categoryId, categories.id),
          eq(transactions.workspaceId, workspaceId),
          lt(transactions.amountMinor, BigInt(0)),
          trusted,
        ),
      )
      // Every category, budgeted or not: seeded workspaces show the taxonomy immediately,
      // and the manual-entry select uses this same list. Realisasi is a left join.
      .where(eq(categories.workspaceId, workspaceId))
      .groupBy(categories.id)
      .orderBy(asc(categories.sort), asc(categories.name)),
    db
      .select({
        id: commitments.id,
        vendor: commitments.vendor,
        totalMinor: commitments.totalMinor,
        paidMinor: commitments.paidMinor,
        dueOn: commitments.dueOn,
      })
      .from(commitments)
      .where(
        and(
          eq(commitments.workspaceId, workspaceId),
          // Column-to-column: "belum lunas" is a paid/total fact, not a status string.
          lt(commitments.paidMinor, commitments.totalMinor),
        ),
      )
      .orderBy(asc(commitments.dueOn)),
    db
      .select({ reconciled: imports.reconciled })
      .from(imports)
      .where(eq(imports.workspaceId, workspaceId))
      .orderBy(desc(imports.createdAt))
      .limit(1),
  ]);

  const totals = totalsRows[0];
  const hasTransactions = (totals?.txCount ?? 0) > 0;
  const balanceMinor = toMinor(totals?.balance);
  const thisIn = toMinor(thisInRows[0]?.total);
  const thisOut = Math.abs(toMinor(thisOutRows[0]?.total));
  const lastIn = toMinor(lastInRows[0]?.total);

  const budgetTargetMinor =
    account.budgetTargetMinor === null ? null : toMinor(account.budgetTargetMinor);
  const budgetedRows = budgetRows.filter((row) => row.budgetMinor !== null);
  const totalBudget = budgetedRows.reduce((sumMinor, row) => sumMinor + toMinor(row.budgetMinor), 0);
  const totalSpent = budgetedRows.reduce(
    (sumMinor, row) => sumMinor + Math.abs(toMinor(row.spent)),
    0,
  );
  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  const pendingCommitments = commitmentRows.map((row) => ({
    ...row,
    total: toMinor(row.totalMinor),
    paid: toMinor(row.paidMinor),
  }));
  const pendingUnpaid = pendingCommitments.reduce((sumMinor, row) => sumMinor + (row.total - row.paid), 0);
  const inflowChange = percentChange(thisIn, lastIn);

  const weddingDays = account.weddingDate ? daysUntil(account.weddingDate, todayIso) : null;

  // One forecast implementation (AGENTS §7). The monthly pace is what actually came in
  // last month, stated as such next to the sentence — never an invented projection.
  const projection = account.weddingDate
    ? forecast({
        balanceMinor,
        committedUnpaidMinor: pendingUnpaid,
        remainingBudgetMinor: remainingBudget,
        plannedMonthlyDepositMinor: lastIn,
        weddingDate: new Date(`${account.weddingDate}T00:00:00Z`),
        today: new Date(`${todayIso}T00:00:00Z`),
      })
    : null;

  const contributionByMember = new Map(contributionRows.map((row) => [row.memberId ?? "", toMinor(row.total)]));
  const allocation = memberRows.map((member) => ({
    ...member,
    total: contributionByMember.get(member.userId) ?? 0,
  }));
  const unattributed = contributionByMember.get("") ?? 0;
  const contributedTotal = allocation.reduce((sumMinor, member) => sumMinor + member.total, 0) + unattributed;

  const lastImport = importRows[0];

  return (
    <div className="dashboard-shell flex flex-col bg-pearl text-ink [--focus-ring:var(--color-emerald)] lg:h-auto lg:min-h-svh lg:flex-row">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-ink"
      >
        Lewati ke konten
      </a>

      {/* Pearl sidebar, gold seam, emerald active state (design.html §1). */}
      <DashboardSidebar
        workspaceName={account.name}
        weddingDate={account.weddingDate}
        members={memberRows.map((member) => ({ userId: member.userId, name: member.name }))}
        active="overview"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden lg:overflow-visible">
          {/* Page title row: on the pearl ground, no bar or frosted header. */}
          <header id="overview" className="mx-auto w-full max-w-[1200px] scroll-mt-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">{account.name}</h1>
                <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
                  {account.weddingDate
                    ? `Menuju ${formatDate(account.weddingDate)} · ${weddingDays} hari lagi.`
                    : "Tanggal pernikahan belum diatur — isi lewat Pengaturan."}
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <DashboardActions
                  workspaceId={workspaceId}
                  inviteCode={account.inviteCode}
                  joinPath={`/join?code=${encodeURIComponent(account.inviteCode)}`}
                  isOwner={account.role === "owner"}
                  initialWeddingDate={account.weddingDate ?? ""}
                  initialBudget={
                    account.budgetTargetMinor === null
                      ? ""
                      : formatRupiah(toMinor(account.budgetTargetMinor))
                  }
                  today={todayIso}
                  categories={budgetRows.map((row) => ({ id: row.id, name: row.name }))}
                  members={memberRows.map((member) => ({
                    id: member.userId,
                    name: member.name,
                  }))}
                />
                <SignOutButton />
              </div>
            </div>
          </header>

          <main
            id="konten"
            className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
          >
            {/* Forecast in words. Without a wedding date there is no projection to state. */}
            <section
              aria-labelledby="proyeksi"
              id="forecast"
              className="flex scroll-mt-6 flex-wrap items-start justify-between gap-x-6 gap-y-2 sm:flex-nowrap"
            >
              <div className="min-w-0">
                {projection === null ? (
                  <>
                    <h2 id="proyeksi" className="font-semibold text-ink">
                      Proyeksi belum bisa dihitung
                    </h2>
                    <p className="mt-1 max-w-[72ch] text-small text-ink-muted">
                      Proyeksi dana butuh tanggal hari H. Sampai tanggalnya diisi, SahFund
                      tidak menampilkan proyeksi — isi lewat Pengaturan, lalu proyeksi
                      muncul.
                    </p>
                  </>
                ) : !hasTransactions && pendingCommitments.length === 0 && budgetedRows.length === 0 ? (
                  <>
                    <h2 id="proyeksi" className="font-semibold text-ink">
                      Belum ada angka untuk diproyeksikan
                    </h2>
                    <p className="mt-1 max-w-[72ch] text-small text-ink-muted">
                      Proyeksi dihitung dari saldo tercatat, komitmen, dan anggaran. Mulai
                      dengan mencatat atau mengimpor mutasi.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 id="proyeksi" className="font-semibold text-ink">
                      {projection.status === "funded" ? "Proyeksi aman." : "Proyeksi belum aman."}{" "}
                      Estimasi saldo hari H{" "}
                      <span className="tabular-nums">{formatRupiah(projection.projectedMinor)}</span>
                      {projection.status === "funded" ? (
                        <>
                          , surplus{" "}
                          <span className="tabular-nums text-emerald">
                            {formatRupiah(projection.projectedMinor - projection.needMinor)}
                          </span>
                          .
                        </>
                      ) : (
                        <>
                          , kurang{" "}
                          <span className="tabular-nums text-danger">
                            {formatRupiah(projection.shortfallAmountMinor)}
                          </span>
                          .
                        </>
                      )}
                    </h2>
                    <p className="mt-1 max-w-[72ch] text-small text-ink-muted">
                      {projection.requiredMonthlyDepositMinor > 0 ? (
                        <>
                          Sisihkan{" "}
                          <span className="font-semibold tabular-nums text-ink">
                            {formatRupiah(
                              perMember(
                                projection.requiredMonthlyDepositMinor,
                                Math.max(1, memberRows.length),
                              ),
                            )}
                          </span>{" "}
                          per orang tiap bulan supaya cashflow tetap aman sampai akad.
                        </>
                      ) : (
                        "Saldo tercatat dan laju tabungan bulan lalu sudah menutup sisa kebutuhan sampai akad."
                      )}
                    </p>
                    <p className="mt-1 text-small text-ink-muted">
                      Dihitung dari saldo tercatat dan uang masuk bulan lalu (
                      {formatRupiah(lastIn)}).
                    </p>
                  </>
                )}
              </div>
              <Link
                href="/dashboard/forecast"
                className={`${LINK} shrink-0 text-small`}
              >
                Simulasi forecast
              </Link>
            </section>

            {/* The one emerald field: total, target and milestones as one object. */}
            <section
              aria-labelledby="total-dana"
              className="hero-field rounded-md p-6 shadow-card [--focus-ring:var(--color-gold)] sm:p-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h2 id="total-dana" className="flex items-center gap-3 text-eyebrow font-bold uppercase tracking-[0.08em] text-gold">
                  <span aria-hidden="true" className="h-px w-6 shrink-0 bg-gold" />
                  Total tabungan pernikahan
                </h2>
                <p className="flex items-center gap-2 text-small text-pearl-muted">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {lastImport
                    ? lastImport.reconciled
                      ? "Impor terakhir cocok dengan saldo bank"
                      : "Impor terakhir belum cocok"
                    : "Belum ada impor mutasi"}
                </p>
              </div>

              <p className="mt-3 text-total font-extrabold tabular-nums text-pearl">
                {hasTransactions ? formatRupiah(balanceMinor) : "—"}
              </p>

              {budgetTargetMinor === null ? (
                <p className="mt-2 text-small text-pearl-muted">
                  Target anggaran belum diatur — isi lewat Pengaturan.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-small text-pearl-muted">
                    <span className="font-semibold tabular-nums text-gold">
                      {percent(balanceMinor, budgetTargetMinor)}%
                    </span>{" "}
                    dari target
                  </p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={budgetTargetMinor}
                    aria-valuenow={Math.min(Math.max(balanceMinor, 0), budgetTargetMinor)}
                    aria-label={`Dana terkumpul ${formatRupiah(balanceMinor)} dari target ${formatRupiah(budgetTargetMinor)}`}
                    className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15"
                  >
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${Math.min(100, percent(balanceMinor, budgetTargetMinor))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-small text-pearl-muted">
                    <span className="tabular-nums">{formatRupiah(0)}</span>
                    <span>
                      Target{" "}
                      <span className="font-semibold tabular-nums text-pearl">
                        {formatRupiah(budgetTargetMinor)}
                      </span>
                    </span>
                  </div>
                </>
              )}

              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3">
                <div className="flex items-baseline justify-between gap-3 border-t border-gold/30 pt-3 sm:block sm:pr-5">
                  <dt className="text-small text-pearl-muted">Kekurangan target</dt>
                  <dd className="text-base font-semibold tabular-nums text-pearl sm:mt-1">
                    {budgetTargetMinor === null ? (
                      <span className="text-small font-normal text-pearl-muted">Belum diatur</span>
                    ) : (
                      <>
                        {formatRupiah(Math.max(0, budgetTargetMinor - balanceMinor))}{" "}
                        <span className="text-small font-normal text-pearl-muted">tersisa</span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-gold/30 pt-3 sm:block sm:border-l sm:pl-5">
                  <dt className="text-small text-pearl-muted">Laju tabungan bulan lalu</dt>
                  <dd className="text-base font-semibold tabular-nums text-pearl sm:mt-1">
                    {formatRupiah(lastIn)}{" "}
                    <span className="text-small font-normal text-pearl-muted">/ bulan</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-gold/30 pt-3 sm:block sm:border-l sm:pl-5">
                  <dt className="text-small text-pearl-muted">Hari menuju akad</dt>
                  <dd className="text-base font-semibold tabular-nums text-pearl sm:mt-1">
                    {weddingDays === null ? (
                      <span className="text-small font-normal text-pearl-muted">Belum diatur</span>
                    ) : (
                      <>
                        {weddingDays} <span className="text-small font-normal text-pearl-muted">hari</span>
                      </>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            {/* This month — four white data cards on the pearl ground. */}
            <section aria-label="Ringkasan bulan ini" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Uang masuk bulan ini"
                value={hasTransactions ? formatRupiah(thisIn) : "—"}
                note={
                  !hasTransactions ? (
                    "Belum ada mutasi tercatat"
                  ) : inflowChange === null ? (
                    "Belum ada pembanding bulan lalu"
                  ) : (
                    <>
                      <span
                        className={`font-semibold tabular-nums ${
                          inflowChange >= 0 ? "text-emerald" : "text-danger"
                        }`}
                      >
                        {inflowChange > 0 ? "+" : ""}
                        {inflowChange}%
                      </span>{" "}
                      vs bulan lalu
                    </>
                  )
                }
              />
              <StatCard
                label="Uang keluar bulan ini"
                value={hasTransactions ? formatRupiah(thisOut) : "—"}
                note={hasTransactions ? "Pengeluaran tercatat bulan ini" : "Belum ada mutasi tercatat"}
              />
              <StatCard
                label="Komitmen tertunda"
                value={pendingCommitments.length > 0 ? formatRupiah(pendingUnpaid) : "—"}
                note={
                  pendingCommitments.length > 0
                    ? `${pendingCommitments.length} vendor belum lunas`
                    : "Tidak ada komitmen tertunda"
                }
              />
              <StatCard
                label="Realisasi anggaran"
                value={budgetedRows.length > 0 ? formatRupiah(totalSpent) : "—"}
                note={
                  budgetedRows.length > 0
                    ? `${percent(totalSpent, totalBudget)}% dari ${formatRupiah(totalBudget)}`
                    : "Belum ada anggaran per pos"
                }
              />
            </section>

            {/* The couple — two people, one axis; attribution only. */}
            <section aria-labelledby="alokasi" className="panel-surface rounded-md p-6">
              <h2 id="alokasi" className="text-h3 font-bold text-ink">
                Alokasi &amp; kemitraan dana
              </h2>
              <p className="mt-1 text-small text-ink-muted">
                Komposisi dana yang terkumpul. Tercatat bersama, setara, tanpa kompetisi.
              </p>

              {contributedTotal === 0 ? (
                <EmptyState>Belum ada dana masuk tercatat.</EmptyState>
              ) : (
                <>
                  <div aria-hidden="true" className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full">
                    {allocation
                      .filter((member) => member.total > 0)
                      .map((member, index) => (
                        <div
                          key={member.userId}
                          className={`h-full ${index === 0 ? "bg-emerald" : "bg-gold"}`}
                          style={{ width: `${percent(member.total, contributedTotal)}%` }}
                        />
                      ))}
                    {unattributed > 0 ? (
                      <div
                        className="h-full bg-emerald-shade"
                        style={{ width: `${percent(unattributed, contributedTotal)}%` }}
                      />
                    ) : null}
                  </div>

                  <ul className="mt-1 divide-y divide-rule">
                    {allocation.map((member, index) => (
                      <li key={member.userId} className="flex items-baseline justify-between gap-3 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              index === 0 ? "bg-emerald" : "bg-gold"
                            }`}
                          />
                          <span className="text-small font-semibold text-ink">Dana {member.name}</span>
                        </span>
                        <span className="flex items-baseline gap-3 text-right">
                          <span className="text-base font-semibold tabular-nums text-ink">
                            {formatRupiah(member.total)}
                          </span>
                          <span className="w-9 text-small tabular-nums text-ink-muted">
                            {percent(member.total, contributedTotal)}%
                          </span>
                        </span>
                      </li>
                    ))}
                    {unattributed > 0 ? (
                      <li className="flex items-baseline justify-between gap-3 py-3">
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-shade" />
                          <span className="text-small font-semibold text-ink">Belum teratribusi</span>
                        </span>
                        <span className="flex items-baseline gap-3 text-right">
                          <span className="text-base font-semibold tabular-nums text-ink">
                            {formatRupiah(unattributed)}
                          </span>
                          <span className="w-9 text-small tabular-nums text-ink-muted">
                            {percent(unattributed, contributedTotal)}%
                          </span>
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </>
              )}

              <p className="mt-2 text-small text-ink-muted">
                {memberRows.length < 2
                  ? "Pasangan belum bergabung ke workspace ini."
                  : "Kedua anggota tercatat di workspace yang sama."}
              </p>
            </section>

            {/* Workbench — graded panels holding white data cards. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="flex flex-col gap-4 lg:col-span-7">
                <section
                  aria-labelledby="anggaran-judul"
                  id="anggaran"
                  className="panel-surface scroll-mt-6 rounded-md p-6"
                >
                  <div className="min-w-0">
                    <h2 id="anggaran-judul" className="text-h3 font-bold text-ink">
                      Anggaran vs realisasi
                    </h2>
                    <p className="mt-1 text-small text-ink-muted">Batas alokasi tiap pos perhelatan</p>
                  </div>

                  {budgetRows.length === 0 ? (
                    <EmptyState>Belum ada kategori di workspace ini.</EmptyState>
                  ) : (
                    <div className="card-sheen mt-4 overflow-x-auto rounded-sm border border-gold/35 p-4">
                      <table className="w-full text-left text-small">
                        <caption className="sr-only">
                          Anggaran, realisasi, dan sisa alokasi per pos perhelatan
                        </caption>
                        <thead>
                          <tr className="border-b border-rule text-ink-muted">
                            <th scope="col" className="pb-2 font-medium">
                              Kategori
                            </th>
                            <th scope="col" className="hidden pb-2 text-right font-medium sm:table-cell">
                              Anggaran
                            </th>
                            <th scope="col" className="hidden pb-2 text-right font-medium sm:table-cell">
                              Terpakai
                            </th>
                            <th scope="col" className="pb-2 text-right font-medium">
                              Sisa alokasi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rule">
                          {budgetRows.map((row) => {
                            const budget = row.budgetMinor === null ? null : toMinor(row.budgetMinor);
                            const spent = Math.abs(toMinor(row.spent));
                            const left = budget === null ? null : budget - spent;
                            const over = left !== null && left < 0;
                            return (
                              <tr key={row.id}>
                                <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                                  {row.name}
                                  <span
                                    className={`block text-small font-normal ${
                                      over ? "text-danger" : "text-ink-muted"
                                    }`}
                                  >
                                    {budget === null
                                      ? spent > 0
                                        ? `${formatRupiah(spent)} terpakai`
                                        : "Belum ada realisasi"
                                      : `${percent(spent, budget)}% terserap${
                                          over ? ", lewat anggaran" : ""
                                        }`}
                                  </span>
                                </th>
                                <td className="hidden py-2.5 pl-3 text-right tabular-nums text-ink sm:table-cell">
                                  {budget === null ? "Belum diatur" : formatRupiah(budget)}
                                </td>
                                <td className="hidden py-2.5 pl-3 text-right tabular-nums text-ink sm:table-cell">
                                  {formatRupiah(spent)}
                                </td>
                                <td
                                  className={`whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums ${
                                    over ? "text-danger" : "text-ink"
                                  }`}
                                >
                                  {left === null ? "—" : formatRupiah(left)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section
                  aria-labelledby="komitmen-judul"
                  id="komitmen"
                  className="panel-surface scroll-mt-6 rounded-md p-6"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id="komitmen-judul" className="text-h3 font-bold text-ink">
                        Komitmen mendatang
                      </h2>
                      <p className="mt-1 text-small text-ink-muted">Sudah dikomitmenkan, belum lunas</p>
                    </div>
                    <Link href="/dashboard/komitmen" className={`${LINK} shrink-0 text-small`}>
                      Semua
                    </Link>
                  </div>

                  {pendingCommitments.length === 0 ? (
                    <EmptyState>Belum ada komitmen yang tercatat.</EmptyState>
                  ) : (
                    <>
                      <div className="card-sheen mt-4 rounded-sm border border-gold/35 px-4">
                        <ul className="divide-y divide-rule">
                          {pendingCommitments.slice(0, 3).map((row) => {
                            const left = row.total - row.paid;
                            return (
                              <li key={row.id} className="py-3">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-small font-medium text-ink">
                                      {row.vendor}
                                    </p>
                                    <p className="truncate text-small text-ink-muted">
                                      {row.dueOn ? `tempo ${formatDate(row.dueOn)}` : "Tempo belum diatur"}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-small font-semibold tabular-nums text-ink">
                                    {formatRupiah(row.total)}
                                  </p>
                                </div>
                                <div
                                  aria-hidden="true"
                                  className="mt-2 h-1 overflow-hidden rounded-full bg-emerald-soft"
                                >
                                  <div
                                    className="h-full rounded-full bg-emerald"
                                    style={{ width: `${Math.min(100, percent(row.paid, row.total))}%` }}
                                  />
                                </div>
                                <p className="mt-1.5 flex justify-between gap-3 text-small tabular-nums text-ink-muted">
                                  <span>Terbayar {formatRupiah(row.paid)}</span>
                                  <span>Sisa {formatRupiah(left)}</span>
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      {pendingCommitments.length > 3 ? (
                        <Link
                          href="/dashboard/komitmen"
                          className={`${LINK} mt-3 inline-block text-small`}
                        >
                          Lihat {pendingCommitments.length - 3} komitmen lainnya
                        </Link>
                      ) : null}
                    </>
                  )}
                </section>
              </div>

              <div className="flex flex-col gap-4 lg:col-span-5">
                <section
                  aria-labelledby="transaksi-judul"
                  id="transaksi"
                  className="panel-surface scroll-mt-6 rounded-md p-6"
                >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="transaksi-judul" className="text-h3 font-bold text-ink">
                      Transaksi terbaru
                    </h2>
                    <p className="mt-1 text-small text-ink-muted">
                      Mutasi rekening &amp; pembayaran langsung
                    </p>
                  </div>
                  <Link href="/dashboard/transaksi" className={`${LINK} shrink-0 text-small`}>
                    Semua
                  </Link>
                </div>

                  {recent.length === 0 ? (
                    <EmptyState>
                      Belum ada transaksi tercatat. Impor mutasi bank atau catat transaksi
                      untuk mulai melihat angka.
                    </EmptyState>
                  ) : (
                    <div className="card-sheen mt-4 rounded-sm border border-gold/35 px-4">
                      <ul className="divide-y divide-rule">
                        {recent.map((row) => {
                          const amount = toMinor(row.amountMinor);
                          const memberIndex = row.memberId
                            ? memberRows.findIndex((member) => member.userId === row.memberId)
                            : -1;
                          return (
                            <li
                              key={row.id}
                              className="flex items-baseline justify-between gap-3 py-3"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-small font-medium text-ink">
                                  {row.description}
                                </span>
                                <span className="block truncate text-small text-ink-muted">
                                  {memberIndex >= 0 ? (
                                    <span
                                      aria-hidden="true"
                                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                                        memberIndex === 0 ? "bg-emerald" : "bg-gold"
                                      }`}
                                    />
                                  ) : null}
                                  {row.memberName ?? "Tanpa anggota"} · {formatDate(row.occurredOn)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span
                                  className={`block text-small font-semibold tabular-nums ${
                                    amount > 0 ? "text-emerald" : "text-ink"
                                  }`}
                                >
                                  {amount > 0 ? `+${formatRupiah(amount)}` : formatRupiah(amount)}
                                </span>
                                <span className="block text-small text-ink-muted">
                                  {row.categoryName ?? "Tanpa kategori"}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </main>
        </div>

        {/* Phone shell: the canvas scrolls above this bar, never underneath it. */}
        <DashboardMobileNav active="overview" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: ReactNode;
}) {
  return (
    <div className="card-sheen rounded-sm border border-gold/35 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 lg:block">
        <p className="text-small text-ink-muted">{label}</p>
        <p className="text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink lg:mt-1">
          {value}
        </p>
      </div>
      <p className="mt-1 text-small text-ink-muted">{note}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-5 text-small text-ink-muted">
      {children}
    </p>
  );
}

/** A signed-in user without a workspace keeps the existing create/join prompt. */
function NoWorkspace({ name }: { name: string }) {
  return (
    <main className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
      <AppHeader userName={name} action={<SignOutButton />} />

      <Container className="py-14 lg:py-20">
        <div className="max-w-[52ch]">
          <Eyebrow>Langkah pertama</Eyebrow>
          <h1 className="mt-4 text-h2 font-bold text-ink">Belum ada workspace</h1>
          <p className="mt-4 text-body text-ink-muted">
            Satu workspace menampung dana nikah kalian berdua: catatan mutasi, target
            anggaran, dan proyeksi sampai hari H.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/workspaces/new" className={BUTTON_PRIMARY}>
              Buat workspace
            </Link>
            <Link href="/join" className={BUTTON_SECONDARY}>
              Punya kode undangan?
            </Link>
          </div>
          <p className="mt-6 text-small text-ink-muted">
            Sudah diundang pasanganmu? Buka tautan undangannya, atau masukkan kode
            10 karakter di halaman gabung.
          </p>
        </div>
      </Container>
    </main>
  );
}
