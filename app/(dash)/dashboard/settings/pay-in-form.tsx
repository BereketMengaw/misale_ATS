'use client'

import { useActionState } from 'react'
import { savePayIn } from './actions'
import type { PaymentDetails } from '@/lib/settings/payment-details'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/ui/field'

/**
 * Where both sides send money. One form, because a changed account has to
 * change in one place — the parent's SMS and the tutor's Telegram message read
 * the same row.
 */
export function PayInForm({ details }: { details: PaymentDetails }) {
  const [state, action] = useActionState(savePayIn, {})

  return (
    <form action={action} className="mt-3 space-y-3">
      <Field label="Name on the account">
        <TextInput name="accountName" defaultValue={details.accountName} placeholder="Misale Tutors" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CBE account">
          <TextInput
            name="cbeAccount"
            defaultValue={details.cbeAccount}
            inputMode="numeric"
            placeholder="1000123456789"
          />
        </Field>
        <Field label="Telebirr number">
          <TextInput
            name="telebirr"
            defaultValue={details.telebirr}
            inputMode="numeric"
            placeholder="0911234567"
          />
        </Field>
      </div>

      <p className="text-xs text-neutral-500">
        The invoice SMS carries <strong>one</strong> of these — CBE if it is set. Amharic bills at 70
        characters a segment and the message already runs to two; a second account line would make
        every bill cost three.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}

      <Button variant="primary" pendingLabel="Saving…">
        Save payment details
      </Button>
    </form>
  )
}
