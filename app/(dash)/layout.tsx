import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Being an auth user is not enough — the operators table is the allowlist.
  const { data: operator } = await supabase
    .from('operators')
    .select('email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold">
            Misale ATS
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-500">
            <Link href="/dashboard/jobs" className="hover:text-neutral-900">
              Jobs
            </Link>
            <Link href="/dashboard/candidates" className="hover:text-neutral-900">
              Candidates
            </Link>
            <Link href="/dashboard/placements" className="hover:text-neutral-900">
              Placements
            </Link>
            <Link href="/dashboard/money" className="hover:text-neutral-900">
              Money
            </Link>
            <Link href="/dashboard/channels" className="hover:text-neutral-900">
              Channels
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span>{operator?.full_name ?? operator?.email ?? user.email}</span>
          <form action={signOut}>
            <button className="text-neutral-500 underline underline-offset-2">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        {operator ? (
          children
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium">This account is not an operator.</p>
            <p className="mt-1 text-neutral-600">
              Add a row to <code>operators</code> with this user&rsquo;s id ({user.id}) to grant
              access.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
