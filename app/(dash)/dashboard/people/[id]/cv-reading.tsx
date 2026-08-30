import { ActionForm, Badge, Button } from '@/components/ui'
import { CV_FIELD_LABEL, type CvField, type CvReading } from '@/lib/candidates/cv'
import { EDUCATION, EXPERIENCE, labelFor } from '@/lib/candidates/options'
import { readCv } from './actions'

/**
 * What the CV turned out to say, under the link to the CV itself.
 *
 * The order is the point. A disagreement is the first thing on the card and the
 * only thing with a colour, because it is the only part that is work: the fills
 * already happened and needed nobody, and the confirmations are just the profile
 * being right. The file is a click away in the same card, which is what makes a
 * disagreement resolvable rather than merely reported.
 */

function value(field: CvField, raw: string | string[]): string {
  if (Array.isArray(raw)) return raw.join(', ')
  if (field === 'education') return labelFor(EDUCATION, raw)
  if (field === 'experience') return labelFor(EXPERIENCE, raw)
  return raw
}

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CvReadingPanel({
  candidateId,
  reading,
  readAt,
  readBy,
  stale,
  readable,
}: {
  candidateId: number
  reading: CvReading | null
  readAt: string | null
  readBy: string | null
  /** The CV was replaced after this reading was made, so it is about another file. */
  stale: boolean
  /** False for a Word document, which stores fine and cannot be read. */
  readable: boolean
}) {
  if (!readable) {
    return (
      <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
        A Word document cannot be read automatically. Open it, or ask them for a PDF.
      </p>
    )
  }

  return (
    <div className="mt-3 border-t border-neutral-100 pt-3">
      {reading && !stale && (
        <>
          {reading.conflicts.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-amber-800">
                The CV disagrees with what they answered. Nothing was changed.
              </p>
              <ul className="space-y-1 text-sm">
                {reading.conflicts.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-neutral-500">{CV_FIELD_LABEL[c.field]}</span>
                    <span>{value(c.field, c.profile)}</span>
                    <span className="text-neutral-400">·</span>
                    <span className="text-amber-800">CV says {value(c.field, c.cv)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reading.additions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">
                The CV also mentions. Not added — it would change which jobs they rank for.
              </p>
              <ul className="space-y-1 text-sm">
                {reading.additions.map((a) => (
                  <li key={a.field} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-neutral-500">{CV_FIELD_LABEL[a.field]}</span>
                    <span>{a.values.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reading.fills.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">
                Taken from the CV, into fields they left empty.
              </p>
              <ul className="space-y-1 text-sm">
                {reading.fills.map((f) => (
                  <li key={f.field} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-neutral-500">{CV_FIELD_LABEL[f.field]}</span>
                    <span>{value(f.field, f.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reading.confirmed.length > 0 && (
            <p className="mb-3 text-xs text-neutral-400">
              Backed up by the CV: {reading.confirmed.map((f) => CV_FIELD_LABEL[f]).join(', ')}.
            </p>
          )}
        </>
      )}

      {stale && (
        <p className="mb-3 text-xs text-amber-700">
          They sent a different CV after this was read{readAt ? ` on ${when(readAt)}` : ''}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ActionForm
          action={readCv}
          fields={reading && !stale ? { candidateId, force: '1' } : { candidateId }}
        >
          <Button variant="secondary" size="sm" pendingLabel="Reading…">
            {reading && !stale ? 'Read it again' : 'Read the CV'}
          </Button>
        </ActionForm>

        {reading && !stale && readAt && (
          <span className="text-xs text-neutral-400">
            Read {when(readAt)}
            {readBy ? ` by ${readBy}` : ''}
          </span>
        )}

        {reading && !stale && reading.conflicts.length === 0 && reading.fills.length === 0 && (
          <Badge tone="faded">Nothing to do</Badge>
        )}
      </div>
    </div>
  )
}
