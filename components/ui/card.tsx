import { buttonClass, type Size, type Variant } from './styles'
import Link from 'next/link'

/** The white panel every section of the dashboard sits in. */
export function Card({
  children,
  className = '',
  tone = 'plain',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'plain' | 'attention' | 'good' | 'alarm' | 'pending'
}) {
  const tones = {
    plain: 'border-neutral-200 bg-white',
    attention: 'border-amber-300 bg-amber-50',
    good: 'border-green-200 bg-green-50',
    alarm: 'border-red-300 bg-red-50',
    pending: 'border-dashed border-neutral-300 bg-white',
  }
  return <section className={`rounded-md border ${tones[tone]} ${className}`}>{children}</section>
}

/** A card's title row, with room for a count or a note on the right. */
export function CardHead({
  title,
  aside,
  tone = 'plain',
  className = '',
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  tone?: 'plain' | 'attention' | 'alarm' | 'muted'
  className?: string
}) {
  const tones = {
    plain: 'text-neutral-900',
    attention: 'text-amber-900',
    alarm: 'text-red-900',
    muted: 'text-neutral-500',
  }
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-3 ${className}`}>
      <h2 className={`text-sm font-medium ${tones[tone]}`}>{title}</h2>
      {aside && <span className="text-xs text-neutral-400">{aside}</span>}
    </div>
  )
}

/** A list of rows inside a card, hairline-separated. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-neutral-100">{children}</div>
}

export function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-4 p-4 ${className}`}>{children}</div>
}

/** A row whose whole surface is a link to a record. */
export function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-wrap items-center gap-4 p-4 hover:bg-neutral-50">
      {children}
    </Link>
  )
}

/** A <Link> that looks like a button. */
export function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
}: {
  href: string
  children: React.ReactNode
  variant?: Variant
  size?: Size
}) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  )
}
