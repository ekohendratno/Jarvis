import { z } from 'zod'
import { requireUser, apiError } from '@/lib/jarvis/auth'
import { createSpeechTicket, edgeAvailable, speechResponse, stopSpeechTicket } from '@/lib/jarvis/edge-speech'
import { EDGE_VOICES } from '@/lib/voice-options'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const id = await createSpeechTicket(user.id, await request.json())
    return Response.json({ id, url: `/api/jarvis/tts?id=${id}` }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError(error) }
}
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return Response.json({ available: await edgeAvailable(), voices: EDGE_VOICES }, { headers: { 'Cache-Control': 'no-store' } })
    return await speechResponse(user.id, z.string().uuid().parse(id), request.signal)
  } catch (error) { return apiError(error) }
}
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request, true)
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json())
    stopSpeechTicket(user.id, id)
    return Response.json({ ok: true })
  } catch (error) { return apiError(error) }
}
