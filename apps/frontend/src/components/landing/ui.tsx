import type { ReactNode } from "react";

/** One pair of outer margins on every screen: 1120px page, 24/48px gutters (DESIGN.md). */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1120px] px-6 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 py-16 lg:scroll-mt-24 lg:py-24 ${className}`}
    >
      {children}
    </section>
  );
}

/** Small uppercase label with the gold tick: the editorial section marker. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[12px] font-bold tracking-[0.08em] text-ink-muted uppercase">
      <span aria-hidden="true" className="h-px w-6 bg-gold" />
      {children}
    </p>
  );
}

const BUTTON_BASE =
  "inline-flex h-12 items-center justify-center rounded-sm px-6 text-[17px] font-bold leading-none transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-px";

export const BUTTON_PRIMARY =
  `${BUTTON_BASE} bg-emerald text-pearl hover:bg-emerald-deep`;

/** On the emerald field the action is gold; emerald fill would vanish there. */
export const BUTTON_ON_EMERALD =
  `${BUTTON_BASE} bg-gold text-emerald hover:bg-gold-hover focus-visible:outline-pearl`;

export const BUTTON_SECONDARY =
  `${BUTTON_BASE} border border-emerald bg-transparent text-emerald hover:bg-emerald-soft`;

/** 44px field on any surface. Pair with `border-gold-line focus:border-emerald` (or danger). */
export const INPUT =
  "h-11 w-full rounded-sm border bg-surface px-3 text-body text-ink outline-none transition-colors placeholder:text-ink-muted focus:ring-2 focus:ring-emerald/25";

/** Inline gold underline that grows on hover — used for links on the dark field. */
export const TEXT_LINK_ON_EMERALD =
  "font-semibold text-pearl underline decoration-gold underline-offset-4 transition-colors duration-150 hover:decoration-pearl";
