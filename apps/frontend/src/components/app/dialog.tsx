/**
 * Chrome shared by every native `<dialog>` in the app shell: the same width, pearl edge,
 * scroll cap, and heading-with-close-button. Built on the browser's focus trap, Escape
 * close and focus return — no hand-rolled focus management.
 */
export const DIALOG_CLASS =
  "modal w-[min(92vw,34rem)] max-h-[85svh] overflow-y-auto rounded-md border border-gold/60 bg-surface p-6 text-ink shadow-card";

export function DialogHeading({
  id,
  title,
  description,
  onClose,
}: {
  id: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-h3 font-bold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-small text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-emerald-soft hover:text-emerald"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
