'use client'

import { useFormStatus } from 'react-dom'
import { buttonClass, type Size, type Variant } from './styles'

type Props = {
  children: React.ReactNode
  variant?: Variant
  size?: Size
  /** Shown while the enclosing form's action is in flight. */
  pendingLabel?: string
  /** Asked before the form submits. For anything that messages real people. */
  confirm?: string
  className?: string
  type?: 'submit' | 'button'
}

/**
 * Every button that submits a server action. It disables itself while the
 * action runs, which is the difference between "did that work?" and knowing.
 */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  pendingLabel,
  confirm,
  className = '',
  type = 'submit',
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type={type}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault() } : undefined}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
