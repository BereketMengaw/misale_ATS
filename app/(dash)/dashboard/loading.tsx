/**
 * Shown the moment a tab is clicked, so the click is never met with nothing
 * while the page's queries run.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[900px] animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-40 rounded bg-neutral-200" />
      <div className="h-4 w-64 rounded bg-neutral-100" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 rounded-md border border-neutral-200 bg-neutral-50" />
        ))}
      </div>
    </div>
  )
}
