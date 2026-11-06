import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Panel } from "@/components/app/ui";
import { BUTTON_PRIMARY, Container } from "@/components/landing/ui";
import { formatDate, formatRupiah } from "@/core/money";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { requireMembership } from "@/lib/membership";
import { DetailsForm } from "./details-form";
import { InvitePanel } from "./invite-panel";

/**
 * The membership-guarded shell (design D11). `requireMembership` has already redirected
 * or not-found'd; this read is scoped to the id the caller is a member of, so a row
 * from another workspace is unreachable (AGENTS §4/§9). Ledger, reports and forecast
 * bodies belong to later epics — this shell owns the wedding-date prompt (US-05) and
 * the invite/settings surfaces (US-07, US-08, US-52).
 */
export async function WorkspaceShell({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const access = await requireMembership(workspaceId);

  const [workspace] = await getDb()
    .select({
      name: workspaces.name,
      weddingDate: workspaces.weddingDate,
      budgetTargetMinor: workspaces.budgetTargetMinor,
      inviteCode: workspaces.inviteCode,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // A membership row without its workspace is not a state the schema allows; treat it
  // as not-found rather than rendering a half-empty shell.
  if (!workspace) notFound();

  const isOwner = access.role === "owner";
  // Money is formatted server-side by the one money module; the form receives rupiah
  // text, which its own schema parses back (NFR-03, AGENTS §7).
  const budgetText =
    workspace.budgetTargetMinor === null ? "" : formatRupiah(Number(workspace.budgetTargetMinor));
  const joinPath = `/join?code=${encodeURIComponent(workspace.inviteCode)}`;

  return (
    <>
      <AppHeader action={<SignOutButton />} />

      <Container className="py-10 lg:py-14">
        <div className="max-w-[820px]">
          <p className="text-small font-bold tracking-[0.08em] text-ink-muted uppercase">
            Workspace
          </p>
          <h1 className="mt-2 text-h2 font-bold text-ink">{workspace.name}</h1>
          <p className="mt-3 text-body text-ink-muted">
            Dana nikah kalian berdua. Atur tanggal dan undang pasanganmu di sini.
          </p>

          {workspace.weddingDate === null ? (
            <div className="mt-8 rounded-md border border-gold/60 bg-emerald-mist p-5">
              <h2 className="text-h3 font-bold text-ink">Tanggal pernikahan belum diatur</h2>
              <p className="mt-2 text-small text-ink-muted">
                Proyeksi dana butuh tanggal hari H. Sampai tanggalnya diisi, SahFund tidak
                menampilkan proyeksi — isi dulu tanggalnya, lalu proyeksi muncul.
              </p>
              <a href="#tanggal-pernikahan" className={`${BUTTON_PRIMARY} mt-4`}>
                Atur tanggal pernikahan
              </a>
            </div>
          ) : (
            <p className="mt-4 text-small text-ink-muted">
              Hari H:{" "}
              <strong className="font-bold text-ink">{formatDate(workspace.weddingDate)}</strong>
            </p>
          )}

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Panel
              id="undangan"
              title="Undangan"
              description={
                isOwner
                  ? "Bagikan kode atau tautan ini, atau kirim undangan lewat email."
                  : "Kode dan tautan workspace kalian."
              }
            >
              <InvitePanel
                workspaceId={workspaceId}
                inviteCode={workspace.inviteCode}
                joinPath={joinPath}
                isOwner={isOwner}
              />
            </Panel>

            <Panel
              id="pengaturan"
              title="Pengaturan"
              description="Tanggal pernikahan dan target anggaran bisa diubah kapan saja."
            >
              <DetailsForm
                workspaceId={workspaceId}
                initialWeddingDate={workspace.weddingDate ?? ""}
                initialBudget={budgetText}
              />
            </Panel>
          </div>
        </div>
      </Container>
    </>
  );
}
