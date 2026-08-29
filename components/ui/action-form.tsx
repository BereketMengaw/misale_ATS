'use client'

import { useActionState } from 'react'

export type ActionState = { error?: string; ok?: string }

/**
 * A form whose server action can refuse, and say so.
 *
 * Plain `<form action={serverAction}>` throws the result away, so an action
 * that declined to do anything looked exactly like one that worked — which is
 * how "Ask top 1" could leave the button sitting there with no explanation.
 */
export function ActionForm({
  action,
  fields,
  children,
  className = '',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  /** Hidden inputs the action needs, as name → value. */
  fields: Record<string, string | number>
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, {} as ActionState)

  return (
    <form action={formAction} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.ok && <p className="mt-1 text-xs text-green-700">{state.ok}</p>}
    </form>
  )
}
