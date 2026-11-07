import Link from "next/link";
import type { ReactNode } from "react";

import { daysUntil, jakartaDay } from "@/core/dashboard";
import { Mark } from "@/components/mark";
import { Icon } from "./dashboard-icons";
import { DashboardSidebarToggle } from "./dashboard-sidebar-toggle";

/**
 * The dashboard chrome shared by `/dashboard` and its subpages. One nav list, so the
 * sidebar and the phone bar can never disagree: Overview, Transaksi, Laporan, Komitmen
 * and Forecast are real pages with `aria-current`; Anggaran stays a section anchor on
 * the dashboard until its own page exists.
 */
export type DashboardSection =
  | "overview"
  | "transaksi"
  | "laporan"
  | "komitmen"
  | "forecast"
  // No nav slot on purpose: a seventh item crowds the phone bar. Its entry point is the
  // "Impor mutasi" action in the dashboard header.
  | "imports";

const NAV = [
  { key: "overview", href: "/dashboard", label: "Overview", icon: "grid" },
  { key: "transaksi", href: "/dashboard/transaksi", label: "Transaksi", icon: "ledger" },
  { key: "laporan", href: "/dashboard/laporan", label: "Laporan", icon: "report" },
  { key: "anggaran", href: "/dashboard#anggaran", label: "Anggaran", icon: "wallet" },
  { key: "komitmen", href: "/dashboard/komitmen", label: "Komitmen", icon: "calendar" },
  { key: "forecast", href: "/dashboard/forecast", label: "Forecast", icon: "trend" },
] as const;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardSidebar({
  workspaceName,
  weddingDate,
  members,
  active,
}: {
  workspaceName: string;
  weddingDate: string | null;
  members: { userId: string; name: string }[];
  active: DashboardSection;
}) {
  const days = weddingDate ? daysUntil(weddingDate, jakartaDay(new Date())) : null;

  return (
    <aside
      id="dashboard-sidebar"
      className="dashboard-sidebar hidden w-60 shrink-0 flex-col gap-6 border-r border-gold/35 bg-pearl px-3 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh"
    >
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          aria-label="SahFund — dashboard"
          className="sidebar-center flex items-center gap-2.5 rounded-xs px-2"
        >
          <Mark size={28} />
          <span className="sidebar-full-only text-h3 font-bold tracking-[-0.02em] text-ink">
            SahFund
          </span>
        </Link>

        <DashboardSidebarToggle />
      </div>

      <div className="sidebar-full-only card-sheen rounded-sm border border-gold/35 p-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="relative flex shrink-0 -space-x-1.5">
            {members.slice(0, 2).map((member, index) => (
              <span
                key={member.userId}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2 ring-surface ${
                  index === 0 ? "bg-emerald text-pearl" : "bg-gold text-emerald"
                }`}
              >
                {initials(member.name)}
              </span>
            ))}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-small font-semibold text-ink">{workspaceName}</span>
            <span className="flex items-center gap-1.5 text-small text-ink-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {days === null ? "Tanggal akad belum diatur" : `${days} hari lagi`}
            </span>
          </span>
        </div>
      </div>

      <nav aria-label="Menu utama" className="text-small">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const current = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={current ? "page" : undefined}
                  className={`sidebar-center flex h-9 items-center gap-2.5 rounded-sm px-3 transition-colors ${
                    current
                      ? "bg-emerald font-semibold text-pearl"
                      : "text-ink-muted hover:bg-emerald-soft hover:text-emerald"
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  <span className="sidebar-full-only">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/** The phone bar: same five destinations, emerald active state, gold top seam. */
export function DashboardMobileNav({ active }: { active: DashboardSection }) {
  return (
    <nav
      aria-label="Navigasi seluler"
      className="shrink-0 border-t border-gold/35 bg-pearl pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden"
    >
      <ul className="flex px-3">
        {NAV.map((item) => {
          const current = item.key === active;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 ${
                  current ? "text-emerald" : "text-ink-muted"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5" />
                <span className={`text-xs ${current ? "font-semibold" : ""}`}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The page frame for dashboard subpages: pearl ground, sidebar on desktop, phone bar
 * below the scroll area on mobile. The main dashboard keeps its own wrappers because
 * its header row is taller; the sidebar and nav themselves are this same component.
 */
export function DashboardShell({
  workspaceName,
  weddingDate,
  members,
  active,
  children,
}: {
  workspaceName: string;
  weddingDate: string | null;
  members: { userId: string; name: string }[];
  active: DashboardSection;
  children: ReactNode;
}) {
  return (
    <div className="dashboard-shell flex flex-col bg-pearl text-ink [--focus-ring:var(--color-emerald)] lg:h-auto lg:min-h-svh lg:flex-row">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-ink"
      >
        Lewati ke konten
      </a>

      <DashboardSidebar
        workspaceName={workspaceName}
        weddingDate={weddingDate}
        members={members}
        active={active}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden lg:overflow-visible">{children}</div>
        <DashboardMobileNav active={active} />
      </div>
    </div>
  );
}
