'use client'

import { useActionState } from 'react'
import { saveDestination } from './actions'
import { COMMON_BANKS, PAYOUT_PROVIDERS } from '@/lib/candidates/payout-details'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/ui/field'
import { inputClass } from '@/components/ui/styles'

/**
 * The operator's fallback for a tutor the bot could not ask. Shown collapsed,
 * because the bot asking at the hire is the normal path and this should not
 * look like the expected way to fill it in.
 */
export function DestinationForm({
  candidateId,
  provider,
  account,
  name,
  bank,
}: {
  candidateId: number
  provider: string | null
  account: string | null
  name: string | null
  bank: string | null
}) {
  const [state, action] = useActionState(saveDestination, {})

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-neutral-500 hover:text-neutral-900">
        {account ? 'Correct these details' : 'Enter it yourself'}
      </summary>

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="candidateId" value={candidateId} />

        <Field label="Paid into">
          <select name="provider" defaultValue={provider ?? ''} className={inputClass}>
            <option value="">Pick one</option>
            {PAYOUT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Only meaningful for "Another bank", but always shown: a select that
            reveals a field on change needs client state for one input, and an
            empty box beside CBE is cheaper than that. The action ignores it. */}
        <Field label="Bank name — only if you picked Another bank">
          <TextInput name="bank" defaultValue={bank ?? ''} placeholder="Awash Bank" list="known-banks" />
          <datalist id="known-banks">
            {COMMON_BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account number">
            <TextInput name="account" defaultValue={account ?? ''} inputMode="numeric" />
          </Field>
          <Field label="Name on the account">
            <TextInput name="payoutName" defaultValue={name ?? ''} />
          </Field>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}

        <Button variant="secondary" size="sm" pendingLabel="Saving…">
          Save
        </Button>
      </form>
    </details>
  )
}
