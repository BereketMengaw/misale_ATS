'use client'

import { useActionState } from 'react'
import { raisePrepayments, type RaiseState } from './actions'
import { Button } from '@/components/ui/button'

/**
 * Catch up placements the hire path never raised a charge for.
 *
 * Not automatic on page load: raising a debt is not something a screen should
 * do because somebody looked at it.
 */
export function RaiseForm({ subtle = false }: { subtle?: boolean }) {
  const [state, action] = useActionState(raisePrepayments, {} as RaiseState)

  return (
    <form action={action} className="space-y-2">
      <Button variant={subtle ? 'secondary' : 'primary'} size="sm" pendingLabel="Raising…">
        Raise missing pre-payments
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  )
}
