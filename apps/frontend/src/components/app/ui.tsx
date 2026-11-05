import type { ReactNode } from "react";

/**
 * App-shell primitives (emerald/pearl, docs/ui/DESIGN.md). The landing and login
 * primitives live in `components/landing/ui.tsx`; these add the card/field/button
 * shapes the signed-in screens share. One screen, one palette — no legacy tokens.
 */

export const CARD =
  "card-sheen rounded-md border border-gold/60 p-5 shadow-card lg:p-6";

export const BUTTON_SMALL =
  "inline-flex h-10 items-center justify-center rounded-sm border border-emerald px-4 text-small font-bold text-emerald transition-colors duration-150 hover:bg-emerald-soft disabled:pointer-events-none disabled:opacity-60";

export const LINK =
  "font-semibold text-emerald underline decoration-gold underline-offset-4 transition-colors duration-150 hover:decoration-emerald";

/** A titled block inside the shell: heading + body, on one card. */
export function Panel({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={CARD}>
      <h2 id={id ? `${id}-title` : undefined} className="text-h3 font-bold text-ink">
        {title}
      </h2>
      {description ? <p className="mt-2 text-small text-ink-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
