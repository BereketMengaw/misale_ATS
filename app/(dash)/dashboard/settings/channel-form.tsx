'use client'

import { useActionState } from 'react'
import { addChannel, type ChannelFormState } from './actions'
import { Button } from '@/components/ui/button'
import { inputClass as input } from '@/components/ui/styles'

export function ChannelForm() {
  const [state, action] = useActionState(addChannel, {} as ChannelFormState)

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Channel</span>
        <input name="target" className={`mt-1 ${input}`} placeholder="@ethiotutors or -1001234567890" />
        <span className="mt-1 block text-xs text-neutral-400">
          Add the bot as an admin first, then paste it here.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Name</span>
        <span className="ml-2 text-xs text-neutral-400">
          for channels you do not own — used for the copy pack
        </span>
        <input name="title" className={`mt-1 ${input}`} placeholder="Addis Tutors Group" />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}

      <Button variant="primary" pendingLabel="Checking…">
        Add channel
      </Button>
    </form>
  )
}
