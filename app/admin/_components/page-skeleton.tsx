/**
 * Placeholder while an admin page reads its data: the page head and a few list cards, in the layout's own spacing.
 *
 * Deliberately NOT `app/admin/loading.tsx`, nor inside a Suspense boundary around a page: that boundary is revealed
 * while a server action refreshes the page, and with Next 15.5 / React 19.2 the refresh then never commits
 * until something else re-renders (a trashed row stayed on screen). Guarded by admin-route-boundaries.test.ts.
 */
function SkeletonCard() {
  return (
    <li className="grid gap-3 rounded bg-card p-4 md:px-5 lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6 lg:py-3.5">
      <div className="h-6 w-24 rounded-xs bg-muted" />
      <div className="grid gap-2">
        <div className="h-5 w-3/5 rounded-xs bg-muted" />
        <div className="h-4 w-4/5 rounded-xs bg-muted" />
      </div>
      <div className="h-10 w-full rounded bg-muted lg:w-72" />
    </li>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="motion-safe:animate-pulse">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true">
        <div className="grid gap-2">
          <div className="h-10 w-56 rounded-xs bg-card md:h-12" />
          <div className="h-4 w-44 rounded-xs bg-card" />
        </div>
        <ul className="mt-8 grid gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ul>
      </div>
    </div>
  );
}
