"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage, describedBy, inputClass } from "@/components/app/form";
import { TableScroll } from "@/components/app/table-scroll";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/landing/ui";
import { formatDate, formatRupiah } from "@/core/money";
import { reconcile, type Reconciliation } from "@/core/reconcile";
import type { Statement, StatementPocket } from "@/core/statement";
import { MAX_IMPORT_ROWS, importStatementSchema } from "@/lib/imports/schema";
import { IssueList } from "./reconcile-issues";

/**
 * US-12–US-16: the preview and the commit. Everything here is derived from the parsed
 * `Statement` on the device; the only network call posts the shared schema's payload and
 * renders the server's response — the server's reconciliation verdict is the verdict
 * (US-16), so after commit nothing reads the client's own `reconcile()` result.
 */

/** What the commit returned, as the screen shows it (the server's numbers, not ours). */
export type ImportedResult = {
  inserted: number;
  duplicates: number;
  reconciliation: Reconciliation;
};

/** Rows rendered in the preview table; the rest are counted, never mounted (AGENTS §6). */
const PREVIEW_ROWS = 20;

export function ImportPreview({
  workspaceId,
  fileName,
  sourceId,
  statement,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  fileName: string;
  sourceId: string;
  statement: Statement;
  onSaved: (result: ImportedResult) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pocketIndex, setPocketIndex] = useState(0);
  /** `null` = follow the document; any string (including "") is the user's override. */
  const [periodOverride, setPeriodOverride] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Totals and the banner are scoped to the selected pocket (US-11).
  const pocket = statement.pockets[pocketIndex] ?? statement.pockets[0];
  const reconciliation = reconcile(pocket);
  const period = periodOverride ?? statement.period ?? detectedPeriod(pocket);
  // The 5,000-row message comes from the shared schema, never re-typed here (US-12).
  const limitMessage = limitError(pocket, sourceId, period);
  const inFileDuplicates = reconciliation.issues.filter((issue) => issue.kind === "duplicate").length;

  async function commit() {
    if (pending || limitMessage) return;
    setMessage(null);

    const payload = {
      ...payloadFor(pocket, sourceId, period),
      // Advisory only: accepted so the client posts one object, then ignored by the
      // server, which re-runs the same `reconcile()` (US-16).
      reconciliation,
    };
    const parsed = importStatementSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Periksa kembali data impor.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/imports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        inserted?: number;
        duplicates?: number;
        reconciliation?: Reconciliation;
      } | null;

      if (!response.ok) {
        // 422 / 429 / 503 — the server's message is the message (AGENTS §8).
        setMessage(typeof body?.message === "string" ? body.message : "Impor gagal disimpan. Coba lagi.");
        return;
      }

      // The flagged-import list below the form is server state: re-read it, no client cache.
      router.refresh();
      onSaved({
        inserted: body?.inserted ?? 0,
        duplicates: body?.duplicates ?? 0,
        reconciliation: body?.reconciliation ?? reconciliation,
      });
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mt-4 text-small text-ink-muted">
        {fileName} · {statement.bank} · {pocket.transactions.length} baris terbaca
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {statement.pockets.length > 1 ? (
          <Field
            id="kantong-impor"
            label="Kantong"
            hint="Total dan transaksi di bawah hanya dari kantong yang dipilih."
          >
            <select
              id="kantong-impor"
              value={pocketIndex}
              onChange={(event) => setPocketIndex(Number(event.target.value))}
              className={inputClass()}
            >
              {statement.pockets.map((option, index) => (
                <option key={`${option.pocketId ?? option.name}-${index}`} value={index}>
                  {option.name} ({option.transactions.length} transaksi)
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="self-end pb-2 text-small text-ink">
            <span className="font-bold">Kantong:</span> {pocket.name}
          </p>
        )}

        <Field
          id="periode-impor"
          label="Periode"
          hint="Terdeteksi dari mutasi. Ubah bila perlu, misalnya “April 2026”."
        >
          <input
            id="periode-impor"
            type="text"
            autoComplete="off"
            maxLength={40}
            value={period}
            onChange={(event) => setPeriodOverride(event.target.value)}
            aria-describedby={describedBy("periode-impor", { hint: true })}
            className={inputClass()}
          />
        </Field>
      </div>

      <ReconciliationBanner reconciliation={reconciliation} />

      <p className="mt-3 text-small text-ink-muted" aria-live="polite">
        {pocket.transactions.length} transaksi siap diimpor
        {inFileDuplicates > 0
          ? ` · ${inFileDuplicates} duplikat di dalam file`
          : " · 0 duplikat di dalam file"}
        . Duplikat terhadap data yang sudah tersimpan baru diketahui saat impor dan
        dilaporkan setelahnya.
      </p>

      {limitMessage ? (
        <p role="alert" className="mt-3 text-small font-bold text-danger">
          {limitMessage}
        </p>
      ) : null}

      <TableScroll label="Tabel pratinjau transaksi impor" className="mt-4">
        <table className="w-full text-left text-small">
          <caption className="sr-only">
            Pratinjau {Math.min(pocket.transactions.length, PREVIEW_ROWS)} baris pertama dari{" "}
            {pocket.transactions.length} transaksi yang akan diimpor.
          </caption>
          <thead>
            <tr className="border-b border-rule text-ink-muted">
              <th scope="col" className="px-3 py-2 font-medium">Tanggal</th>
              <th scope="col" className="px-3 py-2 font-medium">Deskripsi</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Jumlah</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {pocket.transactions.slice(0, PREVIEW_ROWS).map((tx, index) => (
              <tr key={`${tx.date}-${tx.time}-${index}`}>
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink">
                  {formatDate(tx.date)}
                  {tx.time ? ` ${tx.time}` : ""}
                </th>
                <td className="px-3 py-2 text-ink">{tx.description}</td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                    tx.amountMinor > 0 ? "text-emerald" : "text-ink"
                  }`}
                >
                  {tx.amountMinor > 0 ? `+${formatRupiah(tx.amountMinor)}` : formatRupiah(tx.amountMinor)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-muted">
                  {formatRupiah(tx.balanceMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {pocket.transactions.length > PREVIEW_ROWS ? (
        <p className="mt-2 text-small text-ink-muted">
          …dan {pocket.transactions.length - PREVIEW_ROWS} baris lainnya.
        </p>
      ) : null}

      <FormMessage message={message} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={commit}
          disabled={pending || Boolean(limitMessage)}
          className={`${BUTTON_PRIMARY} disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
        >
          {pending
            ? "Mengimpor…"
            : message
              ? "Coba lagi"
              : reconciliation.ok
                ? `Impor ${pocket.transactions.length} transaksi`
                : `Tetap impor ${pocket.transactions.length} transaksi`}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={BUTTON_SECONDARY}>
          Batal
        </button>
      </div>

      {reconciliation.ok ? null : (
        <p className="mt-3 max-w-[62ch] text-small text-ink-muted">
          Batal menyimpan apa pun. Tetap impor menyimpan barisnya dengan tanda “belum cocok”:
          angkanya tidak masuk total laporan sampai Anda mengonfirmasinya.
        </p>
      )}
    </div>
  );
}

/** The green state / issues list, shared by the preview and the post-commit summary. */
export function ReconciliationBanner({ reconciliation }: { reconciliation: Reconciliation }) {
  if (!reconciliation.ok) {
    return (
      <div className="mt-4 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3">
        <p className="text-small font-bold text-danger">Belum cocok dengan saldo bank</p>
        <IssueList issues={reconciliation.issues} />
      </div>
    );
  }

  return (
    <div role="status" className="mt-4 rounded-sm border border-emerald/30 bg-emerald-soft px-4 py-3">
      <p className="flex items-center gap-2 text-small font-bold text-emerald">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald" />
        Cocok dengan saldo bank
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-small sm:grid-cols-4">
        <Figure label="Saldo awal" minor={reconciliation.openingBalanceMinor} />
        <Figure label="Masuk" minor={reconciliation.totalInMinor} />
        <Figure label="Keluar" minor={reconciliation.totalOutMinor} />
        <Figure label="Saldo akhir" minor={reconciliation.closingBalanceMinor} />
      </dl>
    </div>
  );
}

function Figure({ label, minor }: { label: string; minor: number }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{formatRupiah(minor)}</dd>
    </div>
  );
}

/**
 * The POST body: derived rows only — `line`/`raw` and the file itself stay on the device
 * (NFR-01). The one builder, used for the commit and for the client-side limit check.
 */
function payloadFor(pocket: StatementPocket, sourceId: string, period: string) {
  return {
    sourceId,
    pocketName: pocket.name,
    period: period.trim() === "" ? null : period.trim(),
    openingBalanceMinor: pocket.openingBalanceMinor,
    totalInMinor: pocket.totalInMinor,
    totalOutMinor: pocket.totalOutMinor,
    closingBalanceMinor: pocket.closingBalanceMinor,
    transactions: pocket.transactions.map(
      ({ date, time, description, amountMinor, balanceMinor, direction, ref }) => ({
        date,
        time,
        description,
        amountMinor,
        balanceMinor,
        direction,
        ref,
      }),
    ),
  };
}

/** The shared schema's own Bahasa Indonesia message, or null under the cap. */
function limitError(pocket: StatementPocket, sourceId: string, period: string): string | null {
  if (pocket.transactions.length <= MAX_IMPORT_ROWS) return null;
  const parsed = importStatementSchema.safeParse(payloadFor(pocket, sourceId, period));
  if (parsed.success) return null;
  // The array-level issue; per-row issues are not what the user asked about here.
  const issue = parsed.error.issues.find(
    (candidate) => candidate.path.length === 1 && candidate.path[0] === "transactions",
  );
  return issue?.message ?? null;
}

/**
 * "April 2026", or "April – Mei 2026" when the rows cross months. Built from
 * `core/money.ts`'s `formatDate` ("2 April 2026") so the id-ID month names and UTC
 * handling are not re-implemented here.
 */
function detectedPeriod(pocket: StatementPocket): string {
  const firstRow = pocket.transactions[0];
  const lastRow = pocket.transactions[pocket.transactions.length - 1];
  if (!firstRow || !lastRow) return "";
  const first = monthYear(firstRow.date);
  const last = monthYear(lastRow.date);
  return first === last ? first : `${first.split(" ")[0]} – ${last}`;
}

function monthYear(iso: string): string {
  return formatDate(iso).split(" ").slice(1).join(" ");
}
