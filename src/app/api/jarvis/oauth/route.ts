import { z } from 'zod'
import { requireUser, apiError, HttpError } from '@/lib/jarvis/auth'
import { mutateState } from '@/lib/jarvis/storage'
import { beginOAuth, cancelOAuth, disconnectOAuth, verifyOAuth } from '@/lib/jarvis/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const body = await request.json()
    if (body.action === 'configure') {
      const key = z.string().trim().min(1).max(4000).parse(body.apiKey)
      if (!key.startsWith('ak_')) throw new HttpError(400, 'Gunakan Composio Project API Key dengan awalan ak_. Key ck_ adalah Consumer Key untuk Composio Connect dan tidak dapat membuat sesi OAuth aplikasi.')
      await mutateState(user.id, state => { state.settings.composioApiKey = key })
      return Response.json({ configured: true })
    }
    if (body.action === 'clear') {
      await mutateState(user.id, state => { state.settings.composioApiKey = ''; state.pendingOAuth = [] })
      return Response.json({ configured: false })
    }
    if (body.action === 'begin') return Response.json(await beginOAuth(user.id, z.string().max(60).parse(body.app), new URL(request.headers.get('origin')!).origin))
    if (body.action === 'status') return Response.json(await verifyOAuth(user.id, z.string().uuid().parse(body.flow)))
    if (body.action === 'cancel') { await cancelOAuth(user.id, z.string().uuid().parse(body.flow)); return Response.json({ ok: true }) }
    if (body.action === 'disconnect') { await disconnectOAuth(user.id, z.string().uuid().parse(body.id)); return Response.json({ ok: true }) }
    throw new HttpError(400, 'Aksi OAuth tidak dikenal.')
  } catch (error) { return apiError(error) }
}
