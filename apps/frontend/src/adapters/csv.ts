import { parseRupiahMinor } from "../core/money.ts";
import {
  StatementParseError,
  type Statement,
  type StatementPocket,
  type StatementSourceInput,
  type StatementTransaction,
} from "../core/statement.ts";

/**
 * The generic CSV/XLSX adapter (US-10, ADR-06). Columns are mapped by header name to
 * the same canonical `Statement` a Jago import produces, so preview, reconciliation and
 * dedupe do not know or care which bank exported the file.
 *
 * `statementFromRows` is the shared mapper: CSV text is split into rows here, and an
 * XLSX reader (the browser leaf) hands its worksheet rows to the same function — no
 * spreadsheet dependency is added to the server, and no second mapping implementation
 * exists (AGENTS §7).
 */

export type CsvColumnMapping = {
  /** The header text the user mapped for each canonical field. */
  date: string;
  description: string;
  amount: string;
  balance: string;
  time?: string;
  ref?: string;
};

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

export const csvStatementSource = {
  id: "csv",
  label: "CSV / Excel",
  priority: 2,
  canParse(input: StatementSourceInput) {
    return input.kind === "csv";
  },
};

export function parseCsvStatement(
  text: string,
  mapping: CsvColumnMapping,
  pocketName = "Impor CSV",
): Statement {
  if (text.trim() === "") {
    throw new StatementParseError("File kosong — tidak ada baris yang bisa dibaca.");
  }
  const { rows, delimiter } = splitCsv(text);
  return statementFromRows(rows, mapping, pocketName, delimiter);
}

/** Map already-split rows (CSV or a worksheet) into the canonical statement. */
export function statementFromRows(
  rows: string[][],
  mapping: CsvColumnMapping,
  pocketName: string,
  delimiter = ",",
): Statement {
  const header = rows[0];
  if (!header) {
    throw new StatementParseError("File kosong — tidak ada baris judul kolom.");
  }

  const requireColumn = (role: string, columnName: string | undefined): number => {
    if (!columnName) throw new StatementParseError(`Kolom ${role} belum dipilih.`);
    const index = header.findIndex(
      (cell) => cell.trim().toLowerCase() === columnName.trim().toLowerCase(),
    );
    if (index < 0) {
      throw new StatementParseError(`Kolom "${columnName}" tidak ditemukan di baris judul file.`);
    }
    return index;
  };
  const optionalColumn = (role: string, columnName: string | undefined) =>
    columnName === undefined ? undefined : requireColumn(role, columnName);

  const dateIndex = requireColumn("tanggal", mapping.date);
  const descriptionIndex = requireColumn("deskripsi", mapping.description);
  const amountIndex = requireColumn("nominal", mapping.amount);
  const balanceIndex = requireColumn("saldo", mapping.balance);
  const timeIndex = optionalColumn("waktu", mapping.time);
  const refIndex = optionalColumn("referensi", mapping.ref);

  const transactions: StatementTransaction[] = [];

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const lineNo = index + 1;
    const raw = row.join(delimiter);

    if (row.length > header.length) {
      throw new StatementParseError(
        `Baris ${lineNo} punya ${row.length} kolom, sedangkan judul hanya ${header.length}.`,
        { line: lineNo, raw },
      );
    }

    const cell = (at: number | undefined) => (at === undefined ? "" : (row[at] ?? "").trim());

    const date = parseStatementDate(cell(dateIndex));
    if (!date) {
      throw new StatementParseError(
        `Baris ${lineNo}: tanggal "${cell(dateIndex)}" tidak bisa dibaca. Gunakan YYYY-MM-DD atau DD/MM/YYYY.`,
        { line: lineNo, raw },
      );
    }

    const description = cell(descriptionIndex);
    if (!description) {
      throw new StatementParseError(`Baris ${lineNo} tidak punya deskripsi transaksi.`, {
        line: lineNo,
        raw,
      });
    }

    const amountMinor = parseRupiahMinor(cell(amountIndex));
    if (amountMinor === null) {
      throw new StatementParseError(
        `Baris ${lineNo}: nominal "${cell(amountIndex)}" tidak bisa dibaca.`,
        { line: lineNo, raw },
      );
    }

    const balanceMinor = parseRupiahMinor(cell(balanceIndex));
    if (balanceMinor === null) {
      throw new StatementParseError(
        `Baris ${lineNo}: saldo "${cell(balanceIndex)}" tidak bisa dibaca.`,
        { line: lineNo, raw },
      );
    }

    const time = parseStatementTime(cell(timeIndex), lineNo, raw);
    const direction = amountMinor < 0 ? "out" : "in";

    transactions.push({
      date,
      time,
      description,
      amountMinor,
      balanceMinor,
      direction,
      ref: cell(refIndex),
      line: lineNo,
      raw,
    });
  }

  if (transactions.length === 0) {
    throw new StatementParseError("File ini tidak berisi satu pun baris transaksi.");
  }

  const first = transactions[0];
  const last = transactions[transactions.length - 1];
  const pocket: StatementPocket = {
    name: pocketName,
    // A CSV has no printed opening/closing/totals, so they are derived from the rows;
    // reconciliation then verifies the balance chain row by row (US-14).
    openingBalanceMinor: first.balanceMinor - first.amountMinor,
    totalInMinor: transactions.reduce((total, tx) => (tx.amountMinor > 0 ? total + tx.amountMinor : total), 0),
    totalOutMinor: transactions.reduce((total, tx) => (tx.amountMinor < 0 ? total - tx.amountMinor : total), 0),
    closingBalanceMinor: last.balanceMinor,
    transactions,
  };

  return { bank: "csv", kind: "csv", pockets: [pocket] };
}

/** `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, or `DD Mmm YYYY` → ISO date, or null. */
export function parseStatementDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (numeric) return calendarDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const named = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(text);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    return month ? calendarDate(Number(named[3]), month, Number(named[1])) : null;
  }

  return null;
}

/** The date as `YYYY-MM-DD`, or null when the day/month do not exist (e.g. 31/02). */
function calendarDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseStatementTime(value: string, lineNo: number, raw: string): string {
  if (!value) return "";
  const match = /^(\d{1,2})[.:](\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new StatementParseError(`Baris ${lineNo}: waktu "${value}" tidak bisa dibaca.`, {
      line: lineNo,
      raw,
    });
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/**
 * Split CSV text into rows. Minimal RFC 4180: quotes wrap a field and `""` is an
 * escaped quote, on one line.
 *
 * shortcut: a quoted field containing a newline is not supported — bank exports put one
 * row per line; widen this when a file that wraps descriptions appears.
 */
function splitCsv(text: string): { rows: string[][]; delimiter: string } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0] ?? "";
  const delimiter = countOutsideQuotes(header, ";") > countOutsideQuotes(header, ",") ? ";" : ",";
  return { rows: lines.map((line) => splitLine(line, delimiter)), delimiter };
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count++;
  }
  return count;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
