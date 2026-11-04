import { forecast } from "@/core/forecast";
import { rupiahToMinor } from "@/core/money";

/**
 * The example workspace the landing page shows. It is sample data, labelled "Contoh"
 * wherever it appears, and every figure in it adds up to the others.
 */

export type DemoMember = "ayu" | "budi";

export type DemoRow = {
  on: string;
  label: string;
  category: string;
  member: DemoMember | null;
  amountMinor: number;
};

export const EXAMPLE = {
  couple: "Ayu & Budi",
  bank: "Bank Jago",
  pocket: "Dana Nikah",
  period: "Agustus 2026",
  asOf: "3 November 2026",
  weddingDate: "17 Juli 2027",
} as const;

export const OPENING_MINOR = rupiahToMinor(42_000_000);

export const ROWS: DemoRow[] = [
  {
    on: "03 Agu",
    label: "Setoran Ayu",
    category: "Tabungan",
    member: "ayu",
    amountMinor: rupiahToMinor(8_500_000),
  },
  {
    on: "07 Agu",
    label: "DP Gedung Graha",
    category: "Gedung",
    member: null,
    amountMinor: -rupiahToMinor(30_000_000),
  },
  {
    on: "12 Agu",
    label: "DP Katering Dapur Ibu",
    category: "Katering",
    member: "budi",
    amountMinor: -rupiahToMinor(5_000_000),
  },
  {
    on: "18 Agu",
    label: "Setoran Budi",
    category: "Tabungan",
    member: "budi",
    amountMinor: rupiahToMinor(6_500_000),
  },
];

/** The closing balance the bank itself printed — the number the gate compares against. */
export const CLOSING_MINOR = ROWS.reduce(
  (sum, row) => sum + row.amountMinor,
  OPENING_MINOR,
);

export const COMMITMENTS = [
  {
    vendor: "Gedung Graha",
    category: "Gedung",
    totalMinor: rupiahToMinor(60_000_000),
    paidMinor: rupiahToMinor(30_000_000),
    dueOn: "12 Mei 2027",
  },
  {
    vendor: "Katering Dapur Ibu",
    category: "Katering",
    totalMinor: rupiahToMinor(30_000_000),
    paidMinor: rupiahToMinor(5_000_000),
    dueOn: "20 Juni 2027",
  },
  {
    vendor: "Fotografi Kirana",
    category: "Dokumentasi",
    totalMinor: rupiahToMinor(12_000_000),
    paidMinor: 0,
    dueOn: "3 Juli 2027",
  },
];

/** Spent against the seeded wedding categories. Remaining totals 15.000.000. */
export const BUDGETS = [
  {
    name: "Busana",
    spentMinor: rupiahToMinor(4_500_000),
    budgetMinor: rupiahToMinor(12_000_000),
  },
  {
    name: "Undangan",
    spentMinor: rupiahToMinor(1_800_000),
    budgetMinor: rupiahToMinor(3_000_000),
  },
  {
    name: "Cincin",
    spentMinor: rupiahToMinor(6_300_000),
    budgetMinor: rupiahToMinor(12_600_000),
  },
];

export const FORECAST = forecast({
  balanceMinor: CLOSING_MINOR,
  committedUnpaidMinor: COMMITMENTS.reduce(
    (sum, commitment) => sum + (commitment.totalMinor - commitment.paidMinor),
    0,
  ),
  remainingBudgetMinor: BUDGETS.reduce(
    (sum, budget) => sum + (budget.budgetMinor - budget.spentMinor),
    0,
  ),
  plannedMonthlyDepositMinor: rupiahToMinor(5_000_000),
  weddingDate: new Date(Date.UTC(2027, 6, 17)),
  today: new Date(Date.UTC(2026, 10, 3)),
});
