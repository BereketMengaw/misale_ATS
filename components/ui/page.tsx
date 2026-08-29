import Link from 'next/link'

/** The title block at the top of every page. One shape, everywhere. */
export function PageHeader({
  title,
  subtitle,
  back,
  aside,
  action,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** { href, label } for a detail page's way out. */
  back?: { href: string; label: string }
  /** A status pill, sat against the title. */
  aside?: React.ReactNode
  /** The page's one primary action. */
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900">
          &larr; {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold leading-7">{title}</h1>
            {aside}
          </div>
          {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** The small uppercase label above a group. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wide text-neutral-400">{children}</p>
}

/**
 * An empty list. Always says what would put something here, and offers the
 * action when there is one — a dead end is a bug.
 */
export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
      <p className="text-sm text-neutral-500">{children}</p>
      {action}
    </div>
  )
}

/** A failed query. Shown, never swallowed. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
      {children}
    </p>
  )
}

/**
 * The page's own column. Lists and tables get room; detail pages and forms
 * stay narrow enough to read. The shell no longer decides this for everyone.
 */
export function PageShell({
  width = 'wide',
  children,
}: {
  width?: 'wide' | 'narrow'
  children: React.ReactNode
}) {
  return (
    <div className={`mx-auto w-full space-y-6 ${width === 'wide' ? 'max-w-[1120px]' : 'max-w-[900px]'}`}>
      {children}
    </div>
  )
}
