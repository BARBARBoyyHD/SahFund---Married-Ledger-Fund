import type { ReactNode } from "react";

/**
 * The one horizontal-scroll container for data tables (AGENTS §6). The width floor and
 * the overflow live in `globals.css` (`.table-scroll`), so a table never squeezes its
 * columns on a phone — it scrolls instead.
 *
 * It is a named, focusable region: a keyboard user can Tab to it and pan with the arrow
 * keys, and a screen reader announces which table they landed on. `className` carries
 * only the card's own visual dress (padding, border, sheen) so the layout stays at the
 * call site.
 */
export function TableScroll({
  label,
  className,
  children,
}: {
  /** Bahasa Indonesia table name, announced as the region's accessible name. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`table-scroll rounded-sm border border-gold/35${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
