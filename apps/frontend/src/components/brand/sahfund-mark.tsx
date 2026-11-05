/**
 * SahFund mark — the constructed S.
 *
 * Geometry: one stroked path on a 64 grid (weight 10, mitred 45° bends) cut by a
 * diagonal 5-unit gap. Nothing is a font glyph; the S is drawn from primitives so
 * it survives 16px and can be recoloured without redrawing.
 *
 * Tones:
 *   cobalt  — cobalt tile, white S. The default.
 *   inverse — cool-white tile, obsidian S. For dark surfaces.
 *   duo     — white tile, cobalt upper half, rose lower half. The two partners.
 *   mono    — no tile, currentColor. For inline use on any surface.
 *
 * Spec: docs/ui/DESIGN.md. This file does not change the live emerald mark in
 * components/mark.tsx — swap the imports when the cobalt migration lands.
 */

const S_PATH = "M46 12H24L14 22L24 32H40L50 42L40 52H18";

export type MarkTone = "cobalt" | "inverse" | "duo" | "mono";

export function SahFundMark({
  size = 32,
  tone = "cobalt",
  className,
}: {
  size?: number;
  tone?: MarkTone;
  className?: string;
}) {
  const tile =
    tone === "cobalt" ? "#1D4ED8" : tone === "inverse" ? "#F8FAFC" : tone === "duo" ? "#F8FAFC" : null;

  const upper =
    tone === "cobalt" ? "#FFFFFF" : tone === "inverse" ? "#0B0F14" : tone === "duo" ? "#1D4ED8" : "currentColor";
  const lower =
    tone === "cobalt" ? "#FFFFFF" : tone === "inverse" ? "#0B0F14" : tone === "duo" ? "#F43F5E" : "currentColor";

  const id = `sf-gap-${tone}`;
  const clipId = `sf-upper-${tone}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#FFFFFF" />
          <rect x="17" y="29.5" width="30" height="5" transform="rotate(45 32 32)" fill="#000000" />
        </mask>
        {tone === "duo" && (
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <polygon points="0,0 128,0 128,128" />
          </clipPath>
        )}
      </defs>

      {tile && <rect width="64" height="64" rx="16" fill={tile} />}

      <g mask={`url(#${id})`}>
        <path
          d={S_PATH}
          fill="none"
          stroke={lower}
          strokeWidth="10"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        {tone === "duo" && (
          <path
            d={S_PATH}
            fill="none"
            stroke={upper}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            clipPath={`url(#${clipId})`}
          />
        )}
      </g>
    </svg>
  );
}
