import { CopyBox } from '../jobs/[id]/copy-box'
import { describeCost } from '@/lib/messaging/sms'
import { smsQrDataUrl, smsUri } from '@/lib/messaging/qr'

/**
 * One message waiting to be sent, with three ways to send it:
 * on a phone, tap through to Messages; on a laptop, scan the QR with the
 * phone; anywhere, copy the text.
 */
export async function SendCard({ phone, body }: { phone: string | null; body: string }) {
  const qr = phone ? await smsQrDataUrl(phone, body) : null

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <CopyBox text={body} label="Copy the message" />
        <p className="mt-1 text-xs text-neutral-500">{describeCost(body)}</p>
        {phone && (
          <a
            href={smsUri(phone, body)}
            className="mt-2 inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Open in Messages
          </a>
        )}
      </div>

      {qr && (
        <figure className="m-0 shrink-0 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code that opens Messages to ${phone}`} width={110} height={110}
               className="rounded border border-neutral-200 bg-white p-1" />
          <figcaption className="mt-1 text-[10px] leading-tight text-neutral-500">
            On a laptop?<br />Scan with your phone
          </figcaption>
        </figure>
      )}
    </div>
  )
}
