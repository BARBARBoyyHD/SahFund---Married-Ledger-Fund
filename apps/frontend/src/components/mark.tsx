/**
 * The SahFund mark — constructed S.
 *
 * Geometry from the approved reference family: one stroked path on a 48 grid
 * (weight 7, mitred 45° bends) cut by a 4-unit diagonal gap, emerald tile with
 * the gold seal. Not a font glyph, so it survives 16px.
 *
 * Variants (docs/ui/DESIGN.md § Shapes → The mark):
 *   primary — emerald tile, pearl S, gold seal.
 *   inverse — pearl tile, emerald S, gold seal. For emerald fields.
 *
 * The seal is the only place gold touches the mark: stamped, valid, settled.
 */
export function Mark({
  size = 28,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  const tile = inverse ? "#F7F9F6" : "#0D3B2E";
  const stroke = inverse ? "#0D3B2E" : "#F7F9F6";
  const gapId = inverse ? "sf-mark-gap-inverse" : "sf-mark-gap";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask
          id={gapId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="48"
          height="48"
        >
          <rect width="48" height="48" fill="#FFFFFF" />
          <rect x="12" y="22" width="24" height="4" transform="rotate(45 24 24)" fill="#000000" />
        </mask>
      </defs>

      <rect width="48" height="48" rx="12" fill={tile} />
      <path
        d="M35 9H18L10.5 16.5L18 24H30L37.5 31.5L30 39H12"
        fill="none"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        mask={`url(#${gapId})`}
      />
      <rect x="38" y="38" width="5" height="5" rx="1.25" fill="#DFBA73" />
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
