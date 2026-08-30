import { ActionForm, Badge, Button, Card, CardHead } from '@/components/ui'
import type { Tone } from '@/components/ui/badge'
import {
  needsAttention,
  verdictLine,
  type DocumentCheck,
  type Verdict,
} from '@/lib/candidates/documents'
import { MAX_DOCUMENTS_PER_CHECK } from '@/lib/candidates/reading'
import { checkDocuments } from './actions'

/**
 * The degrees and transcripts, and what checking them found.
 *
 * A verdict sits on the row of the document it is about, never as a summary of
 * the person — the operator's next move is always to open one specific file,
 * and a card that said "2 problems" at the top would make him hunt for which.
 */

const TONE: Record<Verdict, Tone> = {
  backs: 'green',
  short: 'amber',
  'name-mismatch': 'red',
  'not-a-document': 'red',
  unclaimed: 'neutral',
  inconclusive: 'faded',
}

const LABEL: Record<Verdict, string> = {
  backs: 'Backs their answer',
  short: 'Lower than they said',
  'name-mismatch': 'Different name',
  'not-a-document': 'Not a document',
  unclaimed: 'Nothing to check',
  inconclusive: 'Says nothing about it',
}

export type DocumentRow = {
  id: number
  name: string
  url: string | null
  check: DocumentCheck | null
  readable: boolean
}

export function DocumentsCard({
  candidateId,
  documents,
}: {
  candidateId: number
  documents: DocumentRow[]
}) {
  const unchecked = documents.filter((d) => !d.check && d.readable).length
  const flagged = documents.filter((d) => d.check && needsAttention(d.check.verdict)).length
  const willCheck = Math.min(unchecked, MAX_DOCUMENTS_PER_CHECK)

  return (
    <Card className="p-4" tone={flagged > 0 ? 'attention' : 'plain'}>
      <CardHead
        title="Educational documents"
        tone={flagged > 0 ? 'attention' : 'plain'}
        className="mb-2"
        aside={documents.length > 0 ? `${documents.length}` : undefined}
      />

      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">None sent.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-700 underline underline-offset-2"
                  >
                    {d.name} ↗
                  </a>
                ) : (
                  <span className="text-sm text-neutral-500">{d.name} — could not be opened</span>
                )}
                {d.check && (
                  <p
                    className={`text-xs ${
                      needsAttention(d.check.verdict) ? 'text-amber-800' : 'text-neutral-400'
                    }`}
                  >
                    {verdictLine(d.check)}
                  </p>
                )}
                {!d.check && !d.readable && (
                  <p className="text-xs text-neutral-400">A Word document — open it yourself.</p>
                )}
              </div>
              {d.check && <Badge tone={TONE[d.check.verdict]}>{LABEL[d.check.verdict]}</Badge>}
            </li>
          ))}
        </ul>
      )}

      {documents.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3">
          <ActionForm
            action={checkDocuments}
            fields={unchecked === 0 ? { candidateId, force: '1' } : { candidateId }}
          >
            <Button variant="secondary" size="sm" pendingLabel="Reading…">
              {unchecked === 0
                ? 'Check them again'
                : `Check ${willCheck} ${willCheck === 1 ? 'document' : 'documents'}`}
            </Button>
          </ActionForm>

          {/* Said before the press, not after. The cap exists so one click on a
              profile with fifteen scans is not fifteen model calls, and an
              operator who cannot see the number would not know it applied. */}
          {unchecked > MAX_DOCUMENTS_PER_CHECK && (
            <span className="text-xs text-neutral-400">
              {unchecked} unchecked — {MAX_DOCUMENTS_PER_CHECK} at a time.
            </span>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        This reads what a document says and compares it with what they answered. It cannot tell a
        forged certificate from a real one, and nothing here is applied to the profile.
      </p>
    </Card>
  )
}
