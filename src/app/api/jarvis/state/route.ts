import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireUser, apiError, HttpError } from '@/lib/jarvis/auth'
import { mutateState, publicState, readState } from '@/lib/jarvis/storage'
import { inspectConnection } from '@/lib/jarvis/mcp'
import { readChatCompletion } from '@/lib/jarvis/provider-response'
import { EDGE_VOICES } from '@/lib/voice-options'
import { AI_PROVIDERS, inferProvider, isLocalEndpoint, providerKey } from '@/lib/ai-providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try { const user = await requireUser(request); return Response.json(publicState(await readState(user.id))) } catch (err) { return apiError(err) }
}

const settingsSchema = z.object({
  providerId: z.string().refine(value => AI_PROVIDERS.some(provider => provider.id === value)).optional(),
  baseUrl: z.string().url().refine(url => /^https?:\/\//i.test(url)), model: z.string().min(1).max(300),
  apiKey: z.string().max(4000).optional(), clearApiKey: z.boolean().optional(),
  language: z.enum(['id-ID', 'en-US']), voiceEnabled: z.boolean(), desktopEnabled: z.boolean(), systemPrompt: z.string().min(1).max(8000),
  speechProvider: z.enum(['browser', 'edge']).optional(),
  speechVoice: z.string().refine(value => EDGE_VOICES.some(voice => voice.id === value), 'Voice Edge tidak didukung.').optional(),
  browserVoice: z.string().max(300).optional(),
  speechRate: z.number().int().min(-30).max(50).optional(),
  speechPitch: z.number().int().min(-30).max(30).optional(),
  speechVolume: z.number().int().min(-50).max(0).optional(),
})

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const body = await request.json()
    if (body.action === 'settings') {
      const value = settingsSchema.parse(body.settings)
      await mutateState(user.id, state => {
        const { apiKey, clearApiKey, ...rest } = value
        const selectedProvider = (rest.providerId || inferProvider(rest.baseUrl)) as typeof state.settings.providerId
        state.settings = { ...state.settings, ...rest, providerId: selectedProvider, apiKey: providerKey(state.settings, rest.baseUrl, apiKey, clearApiKey) }
      })
    } else if (body.action === 'connect') {
      const input = z.object({ app: z.string().max(60), name: z.string().min(1).max(80), url: z.string().url().max(2000), token: z.string().max(4000).default('') }).parse(body.connection)
      const tools = await inspectConnection(input)
      await mutateState(user.id, state => {
        const existing = state.settings.connections.find(c => c.app === input.app)
        const connection = { ...input, id: existing?.id || randomUUID(), toolCount: tools.length, status: 'connected' as const }
        state.settings.connections = state.settings.connections.filter(c => c.app !== input.app).concat(connection)
      })
    } else if (body.action === 'disconnect') {
      const id = z.string().uuid().parse(body.id)
      await mutateState(user.id, state => { state.settings.connections = state.settings.connections.filter(c => c.id !== id) })
    } else if (body.action === 'workflow') {
      const workflow = z.object({ name: z.string().min(1).max(80), command: z.string().min(1).max(8000), approval: z.enum(['always', 'writes-only', 'autonomous']).default('writes-only'), schedule: z.enum(['manual', 'daily', 'weekdays', 'weekly']).default('manual') }).parse(body.workflow)
      await mutateState(user.id, state => { state.workflows.push({ ...workflow, id: randomUUID(), updatedAt: new Date().toISOString() }) })
    } else if (body.action === 'delete-workflow') {
      const id = z.string().uuid().parse(body.id)
      await mutateState(user.id, state => { state.workflows = state.workflows.filter(w => w.id !== id) })
    } else if (body.action === 'delete-conversation') {
      const id = z.string().uuid().parse(body.id)
      await mutateState(user.id, state => { state.conversations = state.conversations.filter(c => c.id !== id) })
    } else if (body.action === 'test-provider') {
      const settings = (await readState(user.id)).settings
      if (!settings.apiKey && !isLocalEndpoint(settings.baseUrl)) throw new HttpError(400, 'Simpan API key terlebih dahulu.')
      const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', headers: { ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ model: settings.model, messages: [{ role: 'user', content: 'Reply only OK.' }], max_tokens: 1024, stream: false }),
        signal: AbortSignal.timeout(90_000), redirect: 'error',
      })
      if (!response.ok) throw new HttpError(400, `Provider menolak permintaan (HTTP ${response.status}). Periksa API key, model, dan base URL.`)
      await readChatCompletion(response)
      return Response.json({ ok: true, message: 'Provider terhubung. Model dapat merespons.' })
    } else throw new HttpError(400, 'Aksi tidak dikenal.')
    return Response.json(publicState(await readState(user.id)))
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues[0].message }, { status: 400 })
    return apiError(err)
  }
}
