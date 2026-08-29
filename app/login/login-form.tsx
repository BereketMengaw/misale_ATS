'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {} as { error?: string })

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        autoComplete="username"
        placeholder="Email"
        required
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        required
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
