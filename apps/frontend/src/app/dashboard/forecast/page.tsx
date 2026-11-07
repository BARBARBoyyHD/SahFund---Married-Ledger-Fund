import { and, desc, eq, gt, gte, lt, lte, sum } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { PageSkeleton } from "@/components/app/skeleton";
import { LINK } from "@/components/app/ui";
import { jakartaDay, monthBounds, toMinor } from "@/core/dashboard";
import { formatDate } from "@/core/money";
import { getDb } from "@/lib/db";
import { commitments, members, transactions, user } from "@/lib/db/schema";
import { trustedTotalsCondition } from "@/lib/ledger/trusted";
import { requireWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardShell } from "../dashboard-nav";
import { ForecastSimulator } from "./forecast-simulator";

export const metadata: Metadata = { title: "Forecast" };

/**
 * US-31 / BRD FR-10. The server computes every input from D1 (workspace-scoped sums);
 * only the planned monthly deposit has no column, so it is the simulator's one input.
 * A missing or past wedding date, or a missing budget target, is explained instead of
 * rendering a misleading projection.
 */
export default function ForecastPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <ForecastContent />
    </Suspense>
  );
}

async function ForecastContent() {
  const workspace = await requireWorkspace();
  const db = getDb();
  const todayIso = jakartaDay(new Date());
  const { lastStart, lastEnd } = monthBounds(todayIso);
  const workspaceId = workspace.workspaceId;
  // US-17 AC3: every transaction aggregate below honours the flagged-import gate.
  const trusted = await trustedTotalsCondition(db, workspaceId);

  const [balanceRows, unpaidRows, spentRows, lastInRows, memberRows] = await Promise.all([
    db
      .select({ total: sum(transactions.amountMinor) })
      .from(transactions)
      .where(and(eq(transactions.workspaceId, workspaceId), trusted)),
    db
      .select({
        total: sum(commitments.totalMinor),
        paid: sum(commitments.paidMinor),
      })
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
    db
      .select({ userId: members.userId, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(desc(members.role)),
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

  const weddingDate = workspace.weddingDate;
  const pastDate = weddingDate !== null && weddingDate < todayIso;

  return (
    <DashboardShell
      workspaceName={workspace.name}
      weddingDate={workspace.weddingDate}
      members={memberRows}
      active="forecast"
    >
      <header className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">
              Forecast dana pernikahan
            </h1>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Satu kalimat: cukup atau kurang, dan berapa yang perlu disisihkan tiap bulan
              sampai hari H.
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        {weddingDate === null ? (
          <ForecastNotice title="Tanggal pernikahan belum diatur">
            Forecast butuh tanggal hari H. Isi tanggal pernikahan lewat Pengaturan di
            dashboard, lalu forecast bisa dihitung.
          </ForecastNotice>
        ) : pastDate ? (
          <ForecastNotice title="Tanggal pernikahan sudah lewat">
            Tanggal yang tercatat adalah {formatDate(weddingDate)}. Forecast tidak dihitung
            untuk tanggal yang sudah lewat — perbarui tanggalnya lewat Pengaturan kalau
            akadnya dijadwalkan ulang.
          </ForecastNotice>
        ) : budgetTargetMinor === null ? (
          <ForecastNotice title="Target anggaran belum diatur">
            Forecast butuh target anggaran untuk menghitung sisa kebutuhan. Isi target
            lewat Pengaturan di dashboard, lalu angka forecast muncul di sini.
          </ForecastNotice>
        ) : (
          <ForecastSimulator
            weddingDate={weddingDate}
            today={todayIso}
            balanceMinor={balanceMinor}
            committedUnpaidMinor={committedUnpaidMinor}
            remainingBudgetMinor={remainingBudgetMinor}
            defaultMonthlyMinor={lastMonthInflowMinor}
          />
        )}
      </main>
    </DashboardShell>
  );
}

/** One explanation state: what is missing and where to fix it — never a fake number. */
function ForecastNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-surface rounded-md p-6">
      <h2 className="text-h3 font-bold text-ink">{title}</h2>
      <div className="mt-2 max-w-[62ch] text-small text-ink-muted">{children}</div>
      <Link href="/dashboard" className={`${LINK} mt-4 inline-block text-small`}>
        Buka dashboard dan atur lewat Pengaturan
      </Link>
    </section>
  );
}
