import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { DEMO_COOKIE, DEMO_EMAIL, isDemoEnabled } from './demo-config'

const sessionGlobal = globalThis as typeof globalThis & { jarvisDemoSecret?: string }
const secret = sessionGlobal.jarvisDemoSecret ??= randomBytes(32).toString('hex')
const SESSION_SECONDS = 60 * 60 * 8

function sign(value: string) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export async function createDemoSession() {
  const expires = String(Date.now() + SESSION_SECONDS * 1000)
  ;(await cookies()).set(DEMO_COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: SESSION_SECONDS,
  })
}

export async function getDemoUser() {
  if (!isDemoEnabled()) return null
  const value = (await cookies()).get(DEMO_COOKIE)?.value
  if (!value) return null
  const [expires, signature, extra] = value.split('.')
  if (extra || !expires || !signature || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return null
  const expected = Buffer.from(sign(expires))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  return { id: 'demo-user', email: DEMO_EMAIL, user_metadata: { full_name: 'Pengguna Demo' } }
}
