"use client";

import { useSyncExternalStore } from "react";

import { Icon } from "./dashboard-icons";

const STORAGE_KEY = "sahfund.sidebar";
const CHANGE_EVENT = "sahfund:sidebar-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function isExpanded() {
  return document.documentElement.dataset.sidebar !== "collapsed";
}

/**
 * Collapse/expand the desktop sidebar. The visual state lives on <html data-sidebar>
 * (set before paint by layout.tsx, styled in globals.css); useSyncExternalStore reads it
 * so hydration keeps the server snapshot and then adopts the stored value without a
 * mismatch or a setState-in-effect. Both icons ship; CSS hides the one that does not apply.
 */
export function DashboardSidebarToggle() {
  const expanded = useSyncExternalStore(subscribe, isExpanded, () => true);

  function toggle() {
    const nextCollapsed = isExpanded();
    if (nextCollapsed) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;

    try {
      localStorage.setItem(STORAGE_KEY, nextCollapsed ? "collapsed" : "expanded");
    } catch {
      // Private mode: the choice just does not survive the next reload.
    }

    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-controls="dashboard-sidebar"
      aria-expanded={expanded}
      aria-label={expanded ? "Tutup menu sidebar" : "Buka menu sidebar"}
      className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-emerald-soft hover:text-emerald"
    >
      <Icon name="collapse" className="sidebar-expanded-only h-4 w-4" />
      <Icon name="expand" className="sidebar-collapsed-only h-4 w-4" />
    </button>
  );
}
