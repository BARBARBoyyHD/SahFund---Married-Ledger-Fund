import { parseRupiahMinor } from "../core/money.ts";
import {
  StatementParseError,
  type Statement,
  type StatementPocket,
  type StatementSource,
  type StatementTransaction,
} from "../core/statement.ts";

/**
 * Bank Jago e-statement adapter (US-09, ADR-06): the caller hands over the PDF's text
 * layer as a string — pdf.js extraction and the no-text-layer check belong to the
 * browser leaf, this module never touches bytes, files or the network.
 *
 * The statement is line-ordered on purpose: Jago's layout is stable and a cell that
 * wraps only repeats the same values (ITA §11 gotcha 8). A line this adapter cannot
 * read is a typed parse failure naming it (US-44), never a silently skipped row.
 *
 * Fixture-driven: the grammar below is the documented Jago e-statement layout
 * (`Kantong:`, `Saldo Awal/Akhir`, `Total Pemasukan/Pengeluaran`). Verify it against a
 * real redacted statement on the first dogfood run (PEP M5) before trusting a new
 * statement version.
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  may: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  aug: 8,
  sep: 9,
  okt: 10,
  oct: 10,
  nov: 11,
  des: 12,
  dec: 12,
};

/** `02 Apr 2026 09:15 Deskripsi -Rp 750.000 Rp 6.750.000` */
const TRANSACTION_LINE = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s+(\d{1,2}[.:]\d{2}))?\s+(.*)$/;
const MONEY_TOKEN = /(\(|-)?\s*Rp\.?\s*([\d][\d.,]*)\)?/g;

type PocketBuilder = {
  name: string;
  pocketId?: string;
  openingBalanceMinor?: number;
  totalInMinor?: number;
  totalOutMinor?: number;
  closingBalanceMinor?: number;
  transactions: StatementTransaction[];
};

export const jagoStatementSource: StatementSource = {
  id: "jago",
  label: "Bank Jago (PDF)",
  priority: 1,
  canParse(input) {
    return input.kind === "pdf-text" && /bank jago|kantong/i.test(input.text);
  },
  parse(input) {
    if (input.kind !== "pdf-text") {
      throw new StatementParseError("Sumber bukan teks PDF Bank Jago.");
    }
    return parseJagoText(input.text);
  },
};

export function parseJagoText(text: string): Statement {
  if (text.trim() === "") {
    // The browser passes an empty string when the PDF has no text layer. Never OCR
    // (BRD §3, ADR-05): the user re-exports a digital PDF or imports a CSV.
    throw new StatementParseError(
      "PDF ini tidak punya lapisan teks, jadi tidak bisa dibaca. SahFund tidak memakai OCR: ekspor ulang sebagai PDF digital, atau impor mutasinya lewat CSV.",
    );
  }

  const builders: PocketBuilder[] = [];
  let current: PocketBuilder | undefined;
  let period: string | undefined;
  let accountName: string | undefined;
  let accountNo: string | undefined;

  const startPocket = (name: string): PocketBuilder => {
    const builder: PocketBuilder = { name: name.trim(), transactions: [] };
    builders.push(builder);
    current = builder;
    return builder;
  };

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) return;

    const pocket = /^kantong\s*:\s*(.+)$/i.exec(line);
    if (pocket) return startPocket(pocket[1]);

    const labelled = labelledAmount(line, lineNo, raw);
    if (labelled) {
      current ??= startPocket("Utama");
      const { label, amountMinor } = labelled;
      if (label === "opening") current.openingBalanceMinor = amountMinor;
      else if (label === "closing") current.closingBalanceMinor = amountMinor;
      else if (label === "totalIn") current.totalInMinor = amountMinor;
      else current.totalOutMinor = amountMinor;
      return;
    }

    const periodLine = /^periode\s*:\s*(.+)$/i.exec(line);
    if (periodLine) {
      period = periodLine[1].trim();
      return;
    }

    const nameLine = /^nama(?:\s+pemilik)?\s*:\s*(.+)$/i.exec(line);
    if (nameLine) {
      accountName = nameLine[1].trim();
      return;
    }

    const accountLine = /^no\.?\s*rekening\s*:\s*(.+)$/i.exec(line);
    if (accountLine) {
      accountNo = accountLine[1].trim();
      return;
    }

    if (TRANSACTION_LINE.test(line)) {
      current ??= startPocket("Utama");
      current.transactions.push(parseTransactionLine(line, raw, lineNo));
    }
    // Anything else is a header, footer or page number — not data.
  });

  const pockets = builders.map(finalizePocket);
  if (pockets.every((pocket) => pocket.transactions.length === 0)) {
    throw new StatementParseError(
      "Tidak ada mutasi yang bisa dibaca dari PDF ini. Pastikan file adalah e-statement Bank Jago, bukan hasil pindaian.",
    );
  }

  return { bank: "Bank Jago", kind: "pdf-text", accountName, accountNo, period, pockets };
}

const LABELS: [RegExp, "opening" | "closing" | "totalIn" | "totalOut"][] = [
  [/^saldo awal\s*:?\s*(.+)$/i, "opening"],
  [/^saldo akhir\s*:?\s*(.+)$/i, "closing"],
  [/^total\s+pemasukan\s*:?\s*(.+)$/i, "totalIn"],
  [/^total\s+pengeluaran\s*:?\s*(.+)$/i, "totalOut"],
];

function labelledAmount(line: string, lineNo: number, raw: string) {
  for (const [pattern, label] of LABELS) {
    const match = pattern.exec(line);
    if (!match) continue;
    const amountMinor = amountFromText(match[1], lineNo, raw);
    return { label, amountMinor };
  }
  return undefined;
}

function parseTransactionLine(line: string, raw: string, lineNo: number): StatementTransaction {
  const match = TRANSACTION_LINE.exec(line);
  // `line` matched TRANSACTION_LINE before this call, so the groups exist.
  const [, dayText, monthText, yearText, timeText, tail] = match as RegExpExecArray;

  const month = MONTHS[monthText.slice(0, 3).toLowerCase()];
  if (!month) {
    throw new StatementParseError(`Baris ${lineNo}: bulan "${monthText}" tidak dikenali.`, {
      line: lineNo,
      raw,
    });
  }

  const tokens = [...tail.matchAll(MONEY_TOKEN)];
  if (tokens.length < 2) {
    throw new StatementParseError(
      `Baris ${lineNo} tidak memuat nominal dan saldo. Periksa baris ini: "${line}".`,
      { line: lineNo, raw },
    );
  }

  // The last two amounts on a Jago row are always the mutation and the running balance.
  const amountToken = tokens[tokens.length - 2];
  const balanceToken = tokens[tokens.length - 1];
  const unsignedAmount = amountFromText(`Rp ${amountToken[2]}`, lineNo, raw);
  const balanceMinor = amountFromText(`Rp ${balanceToken[2]}`, lineNo, raw);
  const out = Boolean(amountToken[1]);

  const description = tail
    .slice(0, amountToken.index)
    .trim()
    .replace(/[\s\-–]+$/, "");
  if (!description) {
    throw new StatementParseError(`Baris ${lineNo} tidak punya deskripsi transaksi.`, {
      line: lineNo,
      raw,
    });
  }

  return {
    date: `${yearText}-${pad(month)}-${pad(Number(dayText))}`,
    time: timeText ? timeText.replace(".", ":") : "",
    description,
    amountMinor: out ? -Math.abs(unsignedAmount) : Math.abs(unsignedAmount),
    balanceMinor,
    direction: out ? "out" : "in",
    ref: "",
    line: lineNo,
    raw,
  };
}

function amountFromText(text: string, lineNo: number, raw: string): number {
  // A printed amount may end with the column separator; drop it before parsing.
  const amountMinor = parseRupiahMinor(text.replace(/[.,]+$/, ""));
  if (amountMinor === null) {
    throw new StatementParseError(`Baris ${lineNo}: nominal "${text.trim()}" tidak bisa dibaca.`, {
      line: lineNo,
      raw,
    });
  }
  return amountMinor;
}

/** Fill the values the statement did not print from the rows themselves. */
function finalizePocket(builder: PocketBuilder): StatementPocket {
  const { transactions } = builder;
  const first = transactions[0];
  const last = transactions[transactions.length - 1];

  const totalInMinor = transactions.reduce(
    (total, tx) => (tx.amountMinor > 0 ? total + tx.amountMinor : total),
    0,
  );
  const totalOutMinor = transactions.reduce(
    (total, tx) => (tx.amountMinor < 0 ? total - tx.amountMinor : total),
    0,
  );

  return {
    name: builder.name,
    pocketId: builder.pocketId,
    openingBalanceMinor:
      builder.openingBalanceMinor ?? (first ? first.balanceMinor - first.amountMinor : 0),
    totalInMinor: builder.totalInMinor ?? totalInMinor,
    totalOutMinor: builder.totalOutMinor ?? totalOutMinor,
    closingBalanceMinor:
      builder.closingBalanceMinor ?? (last ? last.balanceMinor : (builder.openingBalanceMinor ?? 0)),
    transactions,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
