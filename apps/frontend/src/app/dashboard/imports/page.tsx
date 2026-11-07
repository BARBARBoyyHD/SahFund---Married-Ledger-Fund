import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SignOutButton } from "@/components/app/sign-out-button";
import { PageSkeleton } from "@/components/app/skeleton";
import { jakartaDay } from "@/core/dashboard";
import { formatDate } from "@/core/money";
import type { ReconcileIssue } from "@/core/reconcile";
import { getDb } from "@/lib/db";
import { imports, members, user } from "@/lib/db/schema";
import { requireWorkspace } from "@/lib/workspace/workspace-access";
import { DashboardShell } from "../dashboard-nav";
import { ConfirmImportButton } from "./confirm-import-button";
import { ImportFlow } from "./import-flow";
import { IssueList } from "./reconcile-issues";

export const metadata: Metadata = { title: "Impor mutasi" };

/**
 * US-09–US-17: one page for the import flow and the trust gate that follows it. The page
 * is a server component — the flagged list is a workspace-scoped read — and the only
 * client leaves are the file/preview flow and the confirm button.
 */
export default function ImportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-pearl text-ink [--focus-ring:var(--color-emerald)]">
          <PageSkeleton />
        </div>
      }
    >
      <ImportsContent />
    </Suspense>
  );
}

async function ImportsContent() {
  const workspace = await requireWorkspace();
  const db = getDb();
  const workspaceId = workspace.workspaceId;

  const [memberRows, flagged] = await Promise.all([
    db
      .select({ userId: members.userId, name: user.name })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(desc(members.role)),
    db
      .select({
        id: imports.id,
        pocketName: imports.pocketName,
        period: imports.period,
        txCount: imports.txCount,
        issues: imports.issues,
        confirmedAt: imports.confirmedAt,
        createdAt: imports.createdAt,
      })
      .from(imports)
      // Every import that failed reconciliation stays listed, confirmed or not: the
      // marker "belum cocok" outlives the confirmation (US-17).
      .where(and(eq(imports.workspaceId, workspaceId), eq(imports.reconciled, false)))
      .orderBy(desc(imports.createdAt))
      .limit(10),
  ]);

  return (
    <DashboardShell
      workspaceName={workspace.name}
      weddingDate={workspace.weddingDate}
      members={memberRows.map((member) => ({ userId: member.userId, name: member.name }))}
      active="imports"
    >
      <header className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold tracking-[-0.02em] text-ink">Impor mutasi</h1>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Impor e-statement bank jadi transaksi. Berkas dibaca di perangkat Anda, lalu
              barisnya diperiksa terhadap saldo yang tercetak di mutasi sebelum disimpan.
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main
        id="konten"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      >
        <ImportFlow workspaceId={workspaceId} />

        {flagged.length > 0 ? (
          <section aria-labelledby="impor-belum-cocok" className="panel-surface rounded-md p-6">
            <h2 id="impor-belum-cocok" className="text-h3 font-bold text-ink">
              Impor belum cocok
            </h2>
            <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
              Impor di bawah ini tidak cocok dengan saldo bank yang tercetak. Selama belum
              dikonfirmasi, angkanya tidak dihitung di total laporan. Setelah dikonfirmasi
              angkanya ikut dihitung, tetapi tandanya tetap “belum cocok”.
            </p>

            <ul className="mt-4 flex flex-col gap-3">
              {flagged.map((row) => (
                <li key={row.id} className="card-sheen rounded-sm border border-gold/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-small font-bold text-ink">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                        Belum cocok
                        <span className="font-normal text-ink-muted">
                          {row.pocketName}
                          {row.period ? ` · ${row.period}` : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-small text-ink-muted">
                        {row.txCount} transaksi · diimpor{" "}
                        {formatDate(jakartaDay(row.createdAt))}
                      </p>
                    </div>
                    <p
                      className={`text-small font-semibold ${
                        row.confirmedAt ? "text-emerald" : "text-ink"
                      }`}
                    >
                      {row.confirmedAt
                        ? "Sudah dikonfirmasi · dihitung di total"
                        : "Belum masuk total laporan"}
                    </p>
                  </div>

                  <IssueList issues={asIssues(row.issues)} />

                  {row.confirmedAt ? null : (
                    <div className="mt-3">
                      <ConfirmImportButton workspaceId={workspaceId} importId={row.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </DashboardShell>
  );
}

/**
 * `issues` is a whole-row JSON column (rule P6 forbids JSON path queries), so the page
 * only asserts the shape `core/reconcile.ts` wrote.
 */
function asIssues(value: unknown): ReconcileIssue[] {
  return Array.isArray(value) ? (value as ReconcileIssue[]) : [];
}
