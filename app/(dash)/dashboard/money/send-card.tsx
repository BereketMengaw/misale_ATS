import { CopyBox } from '../jobs/[id]/copy-box'
import { describeCost } from '@/lib/messaging/sms'
import { smsQrDataUrl, smsUri } from '@/lib/messaging/qr'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { pushToMyPhone } from './push-action'

/**
 * One message waiting to be sent, with four ways to get it out:
 * tap through on a phone, scan the QR from a laptop, push it to the
 * operator's own Telegram, or copy the text.
 */
export async function SendCard({
  phone,
  body,
  recipient = 'them',
}: {
  phone: string | null
  body: string
  recipient?: string
}) {
  const qr = phone ? await smsQrDataUrl(phone, body) : null

  // Only offer the push once the operator has linked their phone.
  const { data: linked } = await supabaseAdmin()
    .from('operators')
    .select('id')
    .not('telegram_id', 'is', null)
    .limit(1)
    .maybeSingle()

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <CopyBox text={body} label="Copy the message" />
        <p className="mt-1 text-xs text-neutral-500">{describeCost(body)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {phone && (
            <a
              href={smsUri(phone, body)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Open in Messages
            </a>
          )}
          {linked && (
            <form action={pushToMyPhone}>
              <input type="hidden" name="body" value={body} />
              <input type="hidden" name="phone" value={phone ?? ''} />
              <input type="hidden" name="recipient" value={recipient} />
              <button className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700">
                Send to my Telegram
              </button>
            </form>
          )}
        </div>

        {phone && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-400">The raw link</summary>
            <CopyBox text={smsUri(phone, body)} label="Copy the link" />
          </details>
        )}
      </div>

      {qr && (
        <figure className="m-0 shrink-0 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code that opens Messages to ${phone}`}
            width={110}
            height={110}
            className="rounded border border-neutral-200 bg-white p-1"
          />
          <figcaption className="mt-1 text-[10px] leading-tight text-neutral-500">
            On a laptop?<br />Scan with your phone
          </figcaption>
        </figure>
      )}
    </div>
  )
}
