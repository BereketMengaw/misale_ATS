import QRCode from 'qrcode'

/**
 * A QR code for an sms: link.
 *
 * The dashboard gets used on a laptop as well as a phone, and an sms: link
 * does nothing on a laptop — there is no Messages app to open. Scanning this
 * with the phone's camera opens its Messages app with the number and the
 * Amharic body already filled in, which is the same one tap, from the other
 * device.
 */
export function smsUri(phone: string, body: string): string {
  return `sms:${phone.replace(/\s+/g, '')}?body=${encodeURIComponent(body)}`
}

/** An inline data: URL, so nothing is fetched and no image is stored. */
export async function smsQrDataUrl(phone: string, body: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(smsUri(phone, body), {
      errorCorrectionLevel: 'L', // the payload is long; L keeps the grid readable
      margin: 1,
      width: 220,
      color: { dark: '#141A17', light: '#FFFFFF' },
    })
  } catch (err) {
    // A body too long for one QR is not worth failing the page over.
    console.error('QR generation failed', err)
    return null
  }
}
