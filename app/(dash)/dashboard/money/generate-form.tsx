'use client'

import { useActionState } from 'react'
import { generateInvoices, type GenerateState } from './actions'

export function GenerateForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action, pending] = useActionState(generateInvoices, {} as GenerateState)

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Month</span>
        <input
          name="period"
          type="month"
          defaultValue={defaultPeriod}
          className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Generating…' : 'Generate invoices'}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  )
}
