'use client'

import { useState } from 'react'
import { buttonClass } from './styles'

/** Any block of text the operator needs to get out of the browser intact. */
export function CopyBox({ text, label = 'Copy post + link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-2">
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
        {text}
      </pre>
      <button type="button" onClick={copy} className={`mt-2 ${buttonClass('secondary', 'sm')}`}>
        {copied ? 'Copied' : label}
      </button>
    </div>
  )
}
