"use client";

import type { CSSProperties } from "react";
import { useId, useState } from "react";

import { formatRupiah, rupiahToMinor } from "@/core/money";
import { MemberChip } from "@/components/landing/member-chip";
import type { DemoRow } from "@/lib/landing-demo";

type Props = {
  rows: DemoRow[];
  openingMinor: number;
  closingMinor: number;
  bank: string;
  pocket: string;
  period: string;
};

/**
 * The product's own gate, live: the closing balance the bank printed is the only number
 * that may enter the ledger. Everything below it is marketing copy until it reads cocok.
 */
export function ReconcileDemo({
  rows,
  openingMinor,
  closingMinor,
  bank,
  pocket,
  period,
}: Props) {
  const inputId = useId();
  const statusId = useId();
  const [digits, setDigits] = useState("");
  const typedMinor = digits ? rupiahToMinor(Number(digits)) : null;
  const matched = typedMinor === closingMinor;
  const difference = typedMinor === null ? 0 : typedMinor - closingMinor;

  return (
    <div
      data-ui
      className="rounded-md border border-gold bg-surface px-4 py-5 text-ink shadow-card lg:px-7 lg:py-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-bold">
          {bank} · {pocket}
        </p>
        <p className="text-small text-ink-muted">Contoh</p>
      </div>
      <p className="mt-1 text-small text-ink-muted">{period}</p>

      <table className="mt-4 w-full border-collapse text-small">
        <caption className="sr-only">
          Contoh mutasi rekening {pocket} {period}
        </caption>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.on}-${row.label}`}
              className="demo-row align-top"
              style={{ "--row": index } as CSSProperties}
            >
              <th
                scope="row"
                className="w-16 py-2 pr-2 text-left font-normal text-ink-muted"
              >
                {row.on}
              </th>
              <td className="py-2 pr-3">
                <span className="block font-semibold">{row.label}</span>
                <span className="mt-0.5 block text-ink-muted">
                  {row.member ? (
                    <span className="mr-1.5 inline-block align-middle">
                      <MemberChip member={row.member} />
                    </span>
                  ) : null}
                  {row.category}
                </span>
              </td>
              <td
                className={`py-2 text-right font-bold tabular-nums whitespace-nowrap ${
                  row.amountMinor > 0 ? "text-emerald" : "text-ink"
                }`}
              >
                {formatRupiah(row.amountMinor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 text-small">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Saldo awal</dt>
          <dd className="font-semibold tabular-nums">
            {formatRupiah(openingMinor)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Saldo menurut catatan</dt>
          <dd className="font-bold tabular-nums">
            {formatRupiah(closingMinor)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-sm bg-emerald-soft p-4">
        <label htmlFor={inputId} className="block text-small font-bold">
          Saldo terakhir di aplikasi bank
        </label>
        <input
          id={inputId}
          value={digits ? formatRupiah(rupiahToMinor(Number(digits))) : ""}
          onChange={(event) =>
            setDigits(event.target.value.replace(/\D/g, "").slice(0, 13))
          }
          inputMode="numeric"
          autoComplete="off"
          placeholder={formatRupiah(0)}
          aria-describedby={statusId}
          aria-invalid={typedMinor !== null && !matched}
          className="mt-2 h-11 w-full rounded-sm border border-gold-line bg-surface px-3 text-body font-semibold tabular-nums outline-none transition-colors focus:border-emerald focus:ring-2 focus:ring-emerald/25"
        />
        <p id={statusId} aria-live="polite" className="mt-2 text-small">
          {typedMinor === null ? (
            <span className="text-ink-muted">
              Masukkan saldo dari aplikasi bank untuk mencocokkan.
            </span>
          ) : matched ? (
            <span className="inline-flex items-center gap-2 font-bold text-emerald">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 rounded-[3px] bg-emerald"
              />
              Cocok dengan saldo bank.
            </span>
          ) : (
            <span className="font-semibold text-danger">
              Belum cocok. Selisih {formatRupiah(Math.abs(difference))} dari
              catatan.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
