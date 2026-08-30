'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { checkManualMessage, MAX_MANUAL_LENGTH, type Audience } from '@/lib/conversations/compose'
import { sendManualMessage } from '../actions'

/**
 * One line, in the operator's own words.
 *
 * The same pure check runs here and on the server. Here so the wrong language
 * is caught while it can still be retyped rather than after a send; there
 * because a check that only runs in a browser is not a check.
 *
 * Uses useActionState directly rather than <ActionForm> because it needs the
 * one thing ActionForm cannot give it: the box has to empty on a successful
 * send. A sent message left sitting in the textarea is a second copy of it one
 * distracted click away, and there is no unsending a Telegram message.
 */
export function Composer({
  telegramId,
  audience,
  name,
}: {
  telegramId: number
  audience: Audience
  name: string
}) {
  const [text, setText] = useState('')
  const [state, formAction] = useActionState(sendManualMessage, {} as { error?: string; ok?: string })
  const cleared = useRef<string | undefined>(undefined)

  // Only on a fresh success. Keyed on the message object identity so sending
  // the same words twice on purpose still clears the second time.
  useEffect(() => {
    if (state.ok && cleared.current !== state.ok) {
      cleared.current = state.ok
      setText('')
    }
  }, [state])

  const problem = text.trim() ? checkManualMessage(audience, text) : null
  const language = audience === 'parent' ? 'Amharic' : 'English'

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="telegramId" value={telegramId} />

      <label htmlFor="manual-text" className="sr-only">
        Message to {name}
      </label>
      <textarea
        id="manual-text"
        name="text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Write to ${name} in ${language}. It arrives from the bot they already know.`}
        className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          {problem ? (
            <span className="text-amber-700">{problem.message}</span>
          ) : (
            <>
              {language} · Telegram, so length costs nothing
              {text.length > MAX_MANUAL_LENGTH / 2 && ` · ${text.length}/${MAX_MANUAL_LENGTH}`}
            </>
          )}
        </p>

        <Button
          variant="primary"
          size="sm"
          pendingLabel="Sending…"
          confirm={`Send this to ${name} now?`}
        >
          Send
        </Button>
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-xs text-green-700">{state.ok}</p>}
    </form>
  )
}
