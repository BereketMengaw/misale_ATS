'use client'

import { useActionState } from 'react'
import { generateInvoices, type GenerateState } from './actions'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/styles'

export function GenerateForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action] = useActionState(generateInvoices, {} as GenerateState)

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input
        name="period"
        type="month"
        aria-label="Month to invoice"
        defaultValue={defaultPeriod}
        className={`${inputClass} w-auto`}
      />
      <Button variant="primary" pendingLabel="Generating…">
        Generate invoices
      </Button>
      {state.error && <p className="w-full text-right text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="w-full text-right text-sm text-green-700">{state.ok}</p>}
      <p className="w-full text-right text-xs text-neutral-400">
        One per active placement. Running it twice changes nothing.
      </p>
    </form>
  )
}
