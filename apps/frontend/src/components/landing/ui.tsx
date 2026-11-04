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
    <section id={id} className={`py-16 lg:py-24 ${className}`}>
      {children}
    </section>
  );
}

export const BUTTON_PRIMARY =
  "inline-flex h-12 items-center justify-center rounded-sm bg-emerald px-6 text-[17px] font-bold leading-none text-pearl transition-colors duration-150 hover:bg-emerald-deep active:translate-y-px";

/** On the emerald bands the action is gold; emerald fill would vanish there. */
export const BUTTON_ON_EMERALD =
  "inline-flex h-12 items-center justify-center rounded-sm bg-gold px-6 text-[17px] font-bold leading-none text-emerald transition-colors duration-150 hover:bg-gold-hover active:translate-y-px focus-visible:outline-pearl";

export const BUTTON_SECONDARY =
  "inline-flex h-12 items-center justify-center rounded-sm border border-emerald bg-transparent px-6 text-[17px] font-bold leading-none text-emerald transition-colors duration-150 hover:bg-emerald-soft active:translate-y-px";

export const TEXT_LINK_ON_EMERALD =
  "font-semibold text-pearl underline decoration-gold underline-offset-4 transition-colors duration-150 hover:decoration-pearl";
