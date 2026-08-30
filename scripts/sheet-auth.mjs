/**
 * A Google access token from the service-account key. No SDK: one JWT, signed
 * with node's own crypto, exchanged for a token. Adding a dependency for a
 * one-off import costs more than the twenty lines it saves.
 */
import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')

export function key(path = '.gcp-key.json') {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export async function accessToken(scope = 'https://www.googleapis.com/auth/spreadsheets.readonly') {
  const k = key()
  const now = Math.floor(Date.now() / 1000)

  const claim = {
    iss: k.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const jwt = `${unsigned}.${signer.sign(k.private_key, 'base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const body = await res.json()
  if (!res.ok) throw new Error(`token: ${res.status} ${JSON.stringify(body)}`)
  return body.access_token
}
