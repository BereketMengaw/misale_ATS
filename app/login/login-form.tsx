'use client'

import { useActionState } from 'react'
import { signIn } from './actions'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/styles'

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, {} as { error?: string })

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        autoComplete="username"
        placeholder="Email"
        required
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        required
        className={inputClass}
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button variant="primary" pendingLabel="Signing in…" className="w-full">
        Sign in
      </Button>
    </form>
  )
}
