/**
 * Loading state for a page whose content streams behind `<Suspense>` (Cache
 * Components: a session read cannot be part of the static shell). A skeleton, not a
 * spinner over a blank page; the status line tells a screen reader what is happening.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 py-10 lg:px-12 lg:py-16">
      <p role="status" className="sr-only">
        Memuat…
      </p>
      <div aria-hidden="true">
        <div className="h-9 w-56 max-w-full rounded-sm bg-emerald-soft" />
        <div className="mt-6 h-24 rounded-md bg-emerald-soft" />
        <div className="mt-4 h-44 rounded-md bg-emerald-soft" />
      </div>
    </div>
  );
}
