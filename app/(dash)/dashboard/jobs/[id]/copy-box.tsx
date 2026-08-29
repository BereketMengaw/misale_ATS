'use client'

import { useState } from 'react'

/** The copy pack for a channel the bot cannot post to. */
export function CopyBox({ text }: { text: string }) {
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
      <button
        type="button"
        onClick={copy}
        className="mt-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700"
      >
        {copied ? 'Copied' : 'Copy post + link'}
      </button>
    </div>
  )
}
