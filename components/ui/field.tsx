import { inputClass } from './styles'

/**
 * A labelled control. Every input in the dashboard goes through this, so
 * every input has a real <label> attached to it.
 */
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`mt-1 ${inputClass} ${className}`} />
}

export { inputClass }
