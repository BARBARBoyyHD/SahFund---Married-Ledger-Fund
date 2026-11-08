"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { parseCsvStatement, type CsvColumnMapping } from "@/adapters/csv";
import { jagoStatementSource } from "@/adapters/jago";
import { Field, inputClass } from "@/components/app/form";
import { CARD, LINK } from "@/components/app/ui";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/landing/ui";
import { StatementParseError, type Statement } from "@/core/statement";
import { ImportPreview, ReconciliationBanner, type ImportedResult } from "./import-preview";

/**
 * US-09 / US-10 / US-44: pick a file, parse it on this device, then hand the preview the
 * canonical `Statement`. The file never leaves the browser — only the derived rows in the
 * preview's commit are posted (NFR-01).
 *
 * pdf.js is `import()`ed inside the PDF branch only, so it never reaches the root or even
 * the page's initial bundle (AGENTS §6). A parse failure names the offending line and
 * resets cleanly; nothing is persisted until the preview commits.
 */

type ParseFailure = { message: string; line?: number; raw?: string };

type MappingForm = { date: string; description: string; amount: string; balance: string; time: string; ref: string };

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string }
  | { kind: "failed"; fileName: string; failure: ParseFailure }
  | {
      kind: "mapping";
      fileName: string;
      text: string;
      headers: string[];
      mapping: MappingForm;
      pocketName: string;
      failure?: ParseFailure;
    }
  | { kind: "ready"; fileName: string; sourceId: string; statement: Statement }
  | { kind: "saved"; fileName: string; result: ImportedResult };

const MAPPING_FIELDS = [
  { key: "date", label: "Kolom tanggal", required: true, pattern: /tanggal|tgl|date/i },
  {
    key: "description",
    label: "Kolom deskripsi",
    required: true,
    pattern: /keterangan|deskripsi|uraian|berita|description|memo/i,
  },
  {
    key: "amount",
    label: "Kolom nominal",
    required: true,
    pattern: /nominal|jumlah|amount|mutasi|debit/i,
  },
  { key: "balance", label: "Kolom saldo", required: true, pattern: /saldo|balance/i },
  { key: "time", label: "Kolom waktu (opsional)", required: false, pattern: /waktu|jam|time/i },
  {
    key: "ref",
    label: "Kolom referensi (opsional)",
    required: false,
    pattern: /referensi|ref|no\.? transaksi/i,
  },
] as const;

export function ImportFlow({ workspaceId }: { workspaceId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  function reset() {
    setPhase({ kind: "idle" });
    if (fileInput.current) fileInput.current.value = "";
  }

  /** A freshly parsed statement: no pocket/period carry-over from the previous file. */
  function openPreview(fileName: string, sourceId: string, statement: Statement) {
    setPhase({ kind: "ready", fileName, sourceId, statement });
  }

  async function onFile(file: File) {
    setPhase({ kind: "reading", fileName: file.name });

    try {
      if (/\.xlsx?$/i.test(file.name)) {
        // PEP §10 cut candidate 3: XLSX byte decoding needs a spreadsheet dependency that
        // is not in the pinned stack, so the CSV path is the supported one for now.
        throw new StatementParseError(
          "File Excel (.xlsx) belum didukung. Ekspor dulu sebagai CSV dari aplikasi bank Anda, lalu impor file .csv itu.",
        );
      }

      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        // `parse` owns both PDF failures: no text layer (never OCR) and "not a Jago
        // statement" — one source for those messages (ADR-06).
        const statement = jagoStatementSource.parse({
          kind: "pdf-text",
          text: await pdfText(await file.arrayBuffer()),
        });
        openPreview(file.name, "jago", statement);
        return;
      }

      const text = await file.text();
      const headers = headerCells(text);
      if (headers.length === 0) {
        throw new StatementParseError("File kosong — tidak ada baris judul kolom.");
      }
      setPhase({
        kind: "mapping",
        fileName: file.name,
        text,
        headers,
        mapping: guessMapping(headers),
        pocketName: "Utama",
      });
    } catch (error) {
      setPhase({ kind: "failed", fileName: file.name, failure: toFailure(error) });
    }
  }

  function onMappingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase.kind !== "mapping") return;

    const mapping: CsvColumnMapping = {
      date: phase.mapping.date,
      description: phase.mapping.description,
      amount: phase.mapping.amount,
      balance: phase.mapping.balance,
      // The adapter treats "" as a column name, so an unused optional column is omitted.
      time: phase.mapping.time || undefined,
      ref: phase.mapping.ref || undefined,
    };

    try {
      openPreview(phase.fileName, "csv", parseCsvStatement(phase.text, mapping, phase.pocketName.trim()));
    } catch (error) {
      // Keep the mapping form: a wrong column is fixed by choosing another one (US-44).
      setPhase({ ...phase, failure: toFailure(error) });
    }
  }

  const fileInputVisible = phase.kind === "idle" || phase.kind === "failed";

  return (
    <section aria-labelledby="impor-baru" className={CARD}>
      <h2 id="impor-baru" className="text-h3 font-bold text-ink">
        Impor mutasi baru
      </h2>
      <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
        Berkas dibaca di perangkat Anda. Yang dikirim ke server hanya baris mutasi yang sudah
        dirapikan — bukan berkasnya.
      </p>

      {fileInputVisible ? (
        <>
          <div className="mt-5">
            <Field
              id="berkas-mutasi"
              label="Berkas mutasi"
              hint="PDF e-statement Bank Jago, atau CSV ekspor bank lain (maksimal 5.000 transaksi)."
            >
              <input
                ref={fileInput}
                id="berkas-mutasi"
                type="file"
                accept=".pdf,.csv,application/pdf,text/csv"
                aria-describedby="berkas-mutasi-hint"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Clearing lets the same file be picked again after it fails (US-44).
                  event.target.value = "";
                  if (file) void onFile(file);
                }}
                className="block w-full text-small text-ink file:mr-3 file:h-10 file:cursor-pointer file:rounded-sm file:border file:border-emerald file:bg-transparent file:px-4 file:text-small file:font-bold file:text-emerald"
              />
            </Field>
          </div>

          {phase.kind === "idle" ? <EmptyState onPick={() => fileInput.current?.click()} /> : null}
        </>
      ) : null}

      {phase.kind === "reading" ? <Reading fileName={phase.fileName} /> : null}

      {phase.kind === "failed" ? (
        <div role="alert" className="mt-2 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3">
          <p className="text-small font-bold text-danger">Berkas tidak bisa dibaca</p>
          <p className="mt-1 text-small text-ink">{phase.failure.message}</p>
          {phase.failure.line ? (
            <p className="mt-1 text-small text-ink-muted">Baris {phase.failure.line}</p>
          ) : null}
          {phase.failure.raw ? (
            <code className="mt-2 block overflow-x-auto rounded-xs bg-surface px-3 py-2 text-small text-ink">
              {phase.failure.raw}
            </code>
          ) : null}
          <p className="mt-2 text-small text-ink-muted">
            Tidak ada yang tersimpan. Perbaiki berkasnya lalu pilih lagi.
          </p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={`${BUTTON_SECONDARY} mt-3`}
          >
            Pilih berkas lain
          </button>
        </div>
      ) : null}

      {phase.kind === "mapping" ? (
        <div className="mt-4">
          <p className="text-small text-ink-muted">{phase.fileName} · petakan kolom ke data SahFund</p>

          <form onSubmit={onMappingSubmit} noValidate className="mt-4">
            {phase.failure ? (
              <div role="alert" className="mb-4 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3">
                <p className="text-small font-bold text-danger">Kolom belum pas</p>
                <p className="mt-1 text-small text-ink">{phase.failure.message}</p>
                {phase.failure.line ? (
                  <p className="mt-1 text-small text-ink-muted">Baris {phase.failure.line}</p>
                ) : null}
                {phase.failure.raw ? (
                  <code className="mt-2 block overflow-x-auto rounded-xs bg-surface px-3 py-2 text-small text-ink">
                    {phase.failure.raw}
                  </code>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MAPPING_FIELDS.map((field) => {
                const id = `kolom-${field.key}`;
                return (
                  <Field
                    key={field.key}
                    id={id}
                    label={field.label}
                    hint={field.required ? undefined : "Kosongkan bila berkas tidak punya kolom ini."}
                  >
                    <select
                      id={id}
                      value={phase.mapping[field.key]}
                      onChange={(event) =>
                        setPhase({
                          ...phase,
                          failure: undefined,
                          mapping: { ...phase.mapping, [field.key]: event.target.value },
                        })
                      }
                      aria-describedby={field.required ? undefined : `${id}-hint`}
                      className={inputClass()}
                    >
                      <option value="">{field.required ? "Pilih kolom…" : "Tidak dipakai"}</option>
                      {phase.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </Field>
                );
              })}

              <Field id="nama-kantong" label="Nama kantong" hint="Misalnya: Kantong Nikah.">
                <input
                  id="nama-kantong"
                  type="text"
                  autoComplete="off"
                  maxLength={80}
                  value={phase.pocketName}
                  onChange={(event) => setPhase({ ...phase, pocketName: event.target.value })}
                  aria-describedby="nama-kantong-hint"
                  className={inputClass()}
                />
              </Field>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="submit" className={BUTTON_PRIMARY}>
                Lanjut ke pratinjau
              </button>
              <button type="button" onClick={reset} className={BUTTON_SECONDARY}>
                Batal
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {phase.kind === "ready" ? (
        <ImportPreview
          key={`${phase.fileName}-${phase.sourceId}`}
          workspaceId={workspaceId}
          fileName={phase.fileName}
          sourceId={phase.sourceId}
          statement={phase.statement}
          onCancel={reset}
          onSaved={(result) => setPhase({ kind: "saved", fileName: phase.fileName, result })}
        />
      ) : null}

      {phase.kind === "saved" ? (
        <div className="mt-4">
          <h3 className="text-h3 font-bold text-ink">Impor tersimpan</h3>
          <p className="mt-1 text-small font-semibold text-ink" aria-live="polite">
            {phase.result.inserted} transaksi baru · {phase.result.duplicates} duplikat
          </p>
          <p className="mt-1 text-small text-ink-muted">{phase.fileName} sudah masuk ke ledger.</p>

          <ReconciliationBanner reconciliation={phase.result.reconciliation} />

          {phase.result.reconciliation.ok ? null : (
            <p className="mt-3 max-w-[62ch] text-small text-ink-muted">
              Impor ini disimpan sebagai “belum cocok” dan belum dihitung di total laporan.
              Konfirmasikan di daftar “Impor belum cocok” di bawah bila angkanya memang benar.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={reset} className={BUTTON_PRIMARY}>
              Impor berkas lain
            </button>
            <Link href="/dashboard/transaksi" className={LINK}>
              Lihat transaksi
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="mt-4 rounded-sm border border-dashed border-gold/40 px-4 py-6">
      <p className="text-small font-semibold text-ink">Belum ada berkas dipilih.</p>
      <p className="mt-1 max-w-[62ch] text-small text-ink-muted">
        Unduh e-statement PDF dari aplikasi Bank Jago (mutasi rekening dengan lapisan teks,
        bukan hasil pindaian), atau ekspor mutasi rekening bank lain sebagai CSV lalu petakan
        kolomnya di sini.
      </p>
      <button type="button" onClick={onPick} className={`${BUTTON_SECONDARY} mt-3`}>
        Pilih berkas
      </button>
    </div>
  );
}

/** The loading state: a skeleton with a status line, never a blank card (AGENTS §6). */
function Reading({ fileName }: { fileName: string }) {
  return (
    <div aria-busy="true" className="mt-5">
      <p role="status" className="sr-only">
        Membaca {fileName} di perangkat Anda…
      </p>
      <div aria-hidden="true" className="space-y-2">
        <div className="h-4 w-2/3 rounded-xs bg-emerald-soft" />
        <div className="h-16 rounded-sm bg-emerald-soft" />
        <div className="h-10 w-48 rounded-sm bg-emerald-soft" />
      </div>
    </div>
  );
}

function toFailure(error: unknown): ParseFailure {
  // Route-level detail stays in the console; the user sees the Bahasa Indonesia reason
  // (AGENTS §8). No statement line or amount is logged — the file never leaves the device.
  console.error("[import] parse failed", {
    name: error instanceof Error ? error.name : typeof error,
  });

  if (error instanceof StatementParseError) {
    return { message: error.message, line: error.line, raw: error.raw };
  }
  return {
    message:
      "Berkas ini tidak bisa dibaca di perangkat ini. Pastikan file utuh, atau ekspor ulang dari aplikasi bank Anda.",
  };
}

type PdfTextItem = { str?: string; transform?: number[] };

/**
 * The PDF's text layer as lines, in the browser. pdf.js is loaded on demand, never with
 * the page (AGENTS §6 / US-51).
 *
 * shortcut: main-thread extraction (ITA §11 gotcha 5). Importing the worker module sets
 * `globalThis.pdfjsWorker`, which pdf.js uses as its fake-worker message handler — no
 * worker asset to copy into `public/`, no Turbopack worker wiring. Switch to
 * `GlobalWorkerOptions.workerSrc` when the ≤ 5 s p95 budget needs a real worker (PEP M5).
 */
async function pdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const loading = pdfjs.getDocument({ data: new Uint8Array(data) });
  const document = await loading.promise;
  const lines: { y: number; parts: string[] }[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items as PdfTextItem[]) {
      const text = item.str ?? "";
      // Items without a transform are marked content, not text.
      if (text.trim() === "" || !item.transform) continue;
      const y = item.transform[5];
      const last = lines[lines.length - 1];
      // One visual line = same baseline (within a point); a wrapped cell repeats values.
      if (last && Math.abs(last.y - y) <= 1) last.parts.push(text);
      else lines.push({ y, parts: [text] });
    }
  }

  await loading.destroy();
  return lines.map((line) => line.parts.join(" ")).join("\n");
}

/**
 * The header row, for the mapping selects only. `adapters/csv.ts` stays the one parser
 * for the rows themselves and reports every parse error with its line.
 */
function headerCells(text: string): string[] {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim() !== "") ?? "";

  // The adapter's delimiter rule: whichever occurs more often outside quotes.
  const count = (delimiter: string) => {
    let total = 0;
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) total++;
    }
    return total;
  };

  const delimiter = count(";") > count(",") ? ";" : ",";
  return line
    .split(delimiter)
    .map((cell) => cell.replaceAll('"', "").trim())
    .filter((cell) => cell !== "");
}

function guessMapping(headers: string[]): MappingForm {
  const pick = (pattern: RegExp) => headers.find((header) => pattern.test(header)) ?? "";
  return Object.fromEntries(
    MAPPING_FIELDS.map((field) => [field.key, pick(field.pattern)]),
  ) as MappingForm;
}
