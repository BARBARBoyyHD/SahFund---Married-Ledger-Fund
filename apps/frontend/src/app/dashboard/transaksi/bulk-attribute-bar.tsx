"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FormMessage, inputClass } from "@/components/app/form";
import { BUTTON_PRIMARY } from "@/components/landing/ui";

type Outcome = { updated: string[]; notFound: string[] };

type ResponseBody = Partial<Outcome> & { message?: string };

/** The row checkboxes: server-rendered in the table, joined to this form by `form`. */
const rowCheckboxes = () =>
  document.querySelectorAll<HTMLInputElement>('#daftar-transaksi-tabel input[name="ids"]');

/** Counts checked rows and keeps select-all honest about a partial selection. */
function selectionState(selectAll: HTMLInputElement | null): number {
  const boxes = rowCheckboxes();
  let checked = 0;
  boxes.forEach((box) => {
    if (box.checked) checked += 1;
  });
  if (selectAll) selectAll.indeterminate = checked > 0 && checked < boxes.length;
  return checked;
}

/**
 * US-24: one action for a whole selection. The checkboxes live in the server-rendered
 * table and join this form through the `form="bulk-form"` attribute, so the table is
 * never shipped to the client just to hold selection state (AGENTS §6). The response is
 * painted per row — "updated" and "not found" are both listed, never a silent partial.
 */
export function BulkAttributeBar({
  workspaceId,
  members,
  labels,
}: {
  workspaceId: string;
  members: { id: string; name: string }[];
  /** id → "date · description", so a result line names the row the user picked. */
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const selectAll = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function syncSelection() {
    setSelected(selectionState(selectAll.current));
  }

  // The row checkboxes are not React children of this component, so their change
  // events only reach us at document level. Counting here also announces the
  // selection through the live region below.
  useEffect(() => {
    function onChange(event: Event) {
      if (event.target instanceof HTMLInputElement && event.target.name === "ids") {
        setSelected(selectionState(selectAll.current));
      }
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  function clearSelection() {
    rowCheckboxes().forEach((box) => {
      box.checked = false;
    });
    if (selectAll.current) selectAll.current.checked = false;
    syncSelection();
  }

  function toggleAll(event: React.ChangeEvent<HTMLInputElement>) {
    rowCheckboxes().forEach((box) => {
      box.checked = event.target.checked;
    });
    syncSelection();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage(null);
    setOutcome(null);

    // FormData reads every control whose form owner is this form, including the
    // checkboxes rendered inside the table via `form="bulk-form"`.
    const data = new FormData(event.currentTarget);
    const ids = data
      .getAll("ids")
      .filter((value): value is string => typeof value === "string");
    const memberId = String(data.get("memberId") ?? "");

    if (ids.length === 0) {
      setMessage("Pilih minimal satu transaksi lebih dulu.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/transactions/bulk-attribute`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids, memberId }),
        },
      );
      const body = (await response.json().catch(() => null)) as ResponseBody | null;

      if (!response.ok) {
        setMessage(
          typeof body?.message === "string" ? body.message : "Permintaan gagal. Coba lagi.",
        );
        return;
      }

      setOutcome({ updated: body?.updated ?? [], notFound: body?.notFound ?? [] });
      clearSelection();
      // Server state is the source of truth: re-read the page with the new attribution.
      router.refresh();
    } catch {
      setMessage("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-gold/35 bg-surface px-4 py-3">
      <form
        id="bulk-form"
        onSubmit={onSubmit}
        aria-busy={pending}
        aria-label="Atribusikan transaksi terpilih"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[12rem]">
          <label htmlFor="bulk-member" className="block text-small font-bold text-ink">
            Atribusikan ke anggota
          </label>
          <select
            id="bulk-member"
            name="memberId"
            defaultValue=""
            className={`${inputClass()} mt-1.5 max-w-[16rem]`}
          >
            <option value="">Tanpa anggota</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON_PRIMARY} disabled:pointer-events-none disabled:bg-emerald-soft disabled:text-ink-muted disabled:shadow-none`}
        >
          {pending ? "Menyimpan…" : "Atribusikan"}
        </button>

        <label className="flex h-11 items-center gap-2 text-small text-ink-muted">
          <input
            ref={selectAll}
            type="checkbox"
            onChange={toggleAll}
            className="h-4 w-4 accent-emerald"
          />
          Pilih semua di halaman ini
        </label>

        <p className="w-full text-small text-ink-muted sm:w-auto" aria-live="polite">
          {selected > 0
            ? `${selected} transaksi dipilih.`
            : "Pilih baris lewat kotak centang, lalu tentukan anggotanya."}
        </p>
      </form>

      <FormMessage message={message} />

      <div aria-live="polite">
        {outcome ? (
          <div className="mt-3 rounded-sm border border-emerald/30 bg-emerald-soft/50 px-4 py-3">
            <p className="text-small font-semibold text-ink">
              {outcome.updated.length} transaksi diperbarui
              {outcome.notFound.length > 0
                ? `, ${outcome.notFound.length} tidak ditemukan`
                : ""}
              .
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-small text-ink-muted">
              {outcome.updated.map((id) => (
                <li key={`updated-${id}`}>
                  <span className="font-semibold text-emerald">Diperbarui</span> ·{" "}
                  {labels[id] ?? id}
                </li>
              ))}
              {outcome.notFound.map((id) => (
                <li key={`missing-${id}`}>
                  <span className="font-semibold text-danger">Tidak ditemukan</span> ·{" "}
                  {labels[id] ?? `Transaksi ${id}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
