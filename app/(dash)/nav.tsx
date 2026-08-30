'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard', label: 'Today', exact: true },
  { href: '/dashboard/jobs', label: 'Jobs' },
  { href: '/dashboard/people', label: 'People' },
  { href: '/dashboard/inbox', label: 'Inbox' },
  { href: '/dashboard/money', label: 'Money' },
  { href: '/dashboard/settings', label: 'Settings' },
]

/**
 * Six items, and it is always obvious which one you are on. Today carries a
 * count so pending work is visible from every screen — the reason the badge
 * exists is that nothing else in the app ever said "something needs you".
 *
 * Only Today carries one, and Inbox deliberately never will. A number beside
 * Inbox would say people are waiting to be answered, which is the arrangement
 * this whole system exists to avoid.
 */
export function Nav({ waiting }: { waiting: number }) {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
              active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {item.label}
            {item.label === 'Today' && waiting > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-800">
                {waiting}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
