/** The one table shape. Scrolls inside its own box; the page never does. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap py-2 pr-3 text-xs font-medium uppercase tracking-wide text-neutral-400 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td className={`py-2.5 pr-3 ${align === 'right' ? 'text-right tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  )
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-neutral-200">{children}</tr>
    </thead>
  )
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-neutral-100 last:border-0">{children}</tr>
}
