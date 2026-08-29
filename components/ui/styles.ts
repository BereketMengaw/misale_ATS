/**
 * The class strings every control in the dashboard is built from. PURE — no
 * React, so a server component can style a <Link> with the same vocabulary a
 * client <Button> uses.
 */

export type Variant = 'primary' | 'secondary' | 'success' | 'ghost'
export type Size = 'sm' | 'md'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  success: 'bg-green-700 text-white hover:bg-green-800',
  ghost: 'text-neutral-500 underline underline-offset-2 hover:text-neutral-900',
}

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md'): string {
  if (variant === 'ghost') return `${BASE} ${VARIANT.ghost} ${size === 'sm' ? 'text-xs' : 'text-sm'}`
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`
}

/** Every text input, select and textarea in the dashboard. */
export const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
