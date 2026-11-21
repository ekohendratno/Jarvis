import 'server-only'
import { getDemoUser } from '@/lib/auth/demo-session'
import { isDemoEnabled } from '@/lib/auth/demo-config'
import { createClient } from '@/lib/supabase/server'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function requireUser(request: Request, write = false) {
  const url = new URL(request.url)
  let hostname: string
  try { hostname = new URL(`http://${request.headers.get('host') || url.host}`).hostname } catch { throw new HttpError(403, 'Host tidak valid.') }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) throw new HttpError(403, 'Jarvis lokal hanya dapat diakses dari komputer ini.')
  if (write) {
    const origin = request.headers.get('origin')
    if (!origin || new URL(origin).host !== (request.headers.get('host') || url.host)) throw new HttpError(403, 'Asal permintaan tidak valid. Buka Jarvis melalui localhost.')
    const size = Number(request.headers.get('content-length') || 0)
    if (size > 128_000) throw new HttpError(413, 'Permintaan terlalu besar.')
  }
  const user = isDemoEnabled() ? await getDemoUser() : (await (await createClient()).auth.getUser()).data.user
  if (!user) throw new HttpError(401, 'Sesi berakhir. Silakan login kembali.')
  return user
}

export function apiError(err: unknown) {
  if (err instanceof ZodError) return Response.json({ error: err.issues[0]?.message || 'Input tidak valid.' }, { status: 400 })
  return Response.json({ error: err instanceof Error ? err.message : 'Permintaan gagal.' }, { status: err instanceof HttpError ? err.status : 500 })
}
