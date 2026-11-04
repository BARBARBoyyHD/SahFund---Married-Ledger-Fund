/**
 * The SahFund mark, as drawn in docs/ui/DESIGN.md: emerald tile, pearl S, gold seal.
 * Inverse variant for the emerald bands (pearl tile, emerald S).
 */
export function Mark({
  size = 28,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width="48"
        height="48"
        rx="12"
        fill={inverse ? "#F7F9F6" : "#0D3B2E"}
      />
      <path
        d="M36 14 H20 A7 7 0 0 0 20 28 H28 A7 7 0 0 1 28 42 H12"
        fill="none"
        stroke={inverse ? "#0D3B2E" : "#F7F9F6"}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="37" y="37" width="6" height="6" rx="1.5" fill="#DFBA73" />
    </svg>
  );
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-h3 font-bold tracking-[-0.02em] ${
        inverse ? "text-pearl" : "text-ink"
      }`}
    >
      <Mark size={28} inverse={inverse} />
      SahFund
    </span>
  );
}
