import { z } from 'zod'
import { requireUser, apiError, HttpError } from '@/lib/jarvis/auth'
import { readState } from '@/lib/jarvis/storage'
import { parseModels, providerKey } from '@/lib/ai-providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const input = z.object({ baseUrl: z.string().url().refine(value => /^https?:\/\//i.test(value)), apiKey: z.string().max(4000).optional(), clearApiKey: z.boolean().optional() }).parse(await request.json())
    const saved = (await readState(user.id)).settings
    const key = providerKey(saved, input.baseUrl, input.apiKey, input.clearApiKey)
    const response = await fetch(`${input.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Accept: 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]), redirect: 'error', cache: 'no-store',
    })
    if (!response.ok) throw new HttpError(400, response.status === 401 || response.status === 403 ? 'Akses daftar model ditolak. Periksa API key atau isi model manual.' : `Daftar model tidak tersedia (HTTP ${response.status}). Isi model manual.`)
    let body
    try { body = await response.json() } catch { throw new HttpError(400, 'Endpoint /models tidak mengirim JSON. Isi model manual.') }
    return Response.json({ models: parseModels(body) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) return Response.json({ error: 'Pengecekan model melewati batas waktu atau dibatalkan. Isi model manual atau coba lagi.' }, { status: 408 })
    if (error instanceof TypeError) return Response.json({ error: 'Provider tidak dapat dijangkau. Periksa Base URL atau isi model manual.' }, { status: 400 })
    return apiError(error)
  }
}
