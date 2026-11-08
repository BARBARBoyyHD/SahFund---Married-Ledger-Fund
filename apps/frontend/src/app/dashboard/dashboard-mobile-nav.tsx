"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { Mark } from "@/components/mark";
import { Icon } from "./dashboard-icons";

/**
 * The phone chrome: one 56px bar with the menu button, and the nav itself in a native
 * `<dialog>` sheet. `showModal` gives the focus trap, Escape close, backdrop and focus
 * return to the button — the same contract every other dialog in the app uses.
 */
export function DashboardMobileNav({ children }: { children: ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    drawer.current?.showModal();
  }

  function hide() {
    drawer.current?.close();
  }

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gold/35 bg-pearl px-4 lg:hidden">
        <button
          type="button"
          onClick={show}
          aria-label="Buka menu navigasi"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="dashboard-menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm text-ink transition-colors hover:bg-emerald-soft hover:text-emerald"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>

        <Link
          href="/dashboard"
          aria-label="SahFund — dashboard"
          className="flex items-center gap-2 rounded-xs"
        >
          <Mark size={24} />
          <span className="text-h3 font-bold tracking-[-0.02em] text-ink">SahFund</span>
        </Link>
      </div>

      <dialog
        ref={drawer}
        id="dashboard-menu"
        aria-label="Menu navigasi"
        className="nav-drawer"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) hide();
        }}
      >
        <div className="flex justify-end p-2">
          <button
            type="button"
            onClick={hide}
            aria-label="Tutup menu navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-emerald-soft hover:text-emerald"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-3 pb-6">{children}</div>
      </dialog>
    </>
  );
}
