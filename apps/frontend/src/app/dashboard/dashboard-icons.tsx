/**
 * The dashboard's icons, drawn on the same 24px lucide grid the design file uses
 * (1.5 stroke, round caps). Inline because `lucide-react` is not a dependency and
 * AGENTS §1 forbids adding one for a handful of glyphs. Decorative by default —
 * the surrounding link or button carries the accessible name.
 */
const PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  ledger: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M16 12h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>
  ),
  report: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 17v-4M13 17v-8M18 17V5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  collapse: (
    <>
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </>
  ),
  expand: (
    <>
      <path d="M13 17l5-5-5-5" />
      <path d="M6 17l5-5-5-5" />
    </>
  ),
} as const;

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
