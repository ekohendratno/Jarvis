import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { ComposioClient } from '@/lib/composio-client'
import { OAUTH_APPS, accountMatches, safeAuthorizationUrl } from '@/lib/oauth-apps'
import { mutateState, readState } from './storage'
import { HttpError } from './auth'
import type { Connection } from '@/types/jarvis'

const entityId = (userId: string) => `jarvis_${createHash('sha256').update(userId).digest('hex').slice(0, 32)}`
export async function beginOAuth(userId: string, app: string, origin: string) {
  const definition = OAUTH_APPS[app]
  if (!definition) throw new HttpError(400, 'Aplikasi ini belum mendukung koneksi OAuth bawaan.')
  const saved = await readState(userId)
  const key = saved.settings.composioApiKey
  if (!key) throw new HttpError(400, 'Isi project API key Composio pada Pengaturan koneksi sekali terlebih dahulu.')
  const client = new ComposioClient(key)
  const flow = randomUUID()
  const callback = `${origin}/api/jarvis/oauth/callback?flow=${flow}`
  const created = await client.call('/tool_router/session', 'POST', {
    user_id: entityId(userId), toolkits: { enable: [definition.toolkit] }, instant: false,
    workbench: { enable: false }, manage_connections: { enable: false },
  })
  if (typeof created.session_id !== 'string') throw new Error('Layanan OAuth tidak mengembalikan session ID.')
  const sessionId = created.session_id
  try {
    const link = await client.call(`/tool_router/session/${encodeURIComponent(sessionId)}/link`, 'POST', { toolkit: definition.toolkit, callback_url: callback })
    if (typeof link.connected_account_id !== 'string' || typeof link.redirect_url !== 'string') throw new Error('Layanan OAuth tidak mengembalikan tautan login yang valid.')
    const authorizationUrl = safeAuthorizationUrl(link.redirect_url)
    await mutateState(userId, state => {
      state.pendingOAuth = state.pendingOAuth.filter(item => Date.now() - new Date(item.createdAt).getTime() < 10 * 60_000)
      if (state.pendingOAuth.length >= 10) throw new HttpError(429, 'Terlalu banyak login yang tertunda. Selesaikan atau batalkan login sebelumnya.')
      state.pendingOAuth.push({ id: flow, app, toolkit: definition.toolkit, sessionId, accountId: String(link.connected_account_id), apiKey: key, createdAt: new Date().toISOString() })
    })
    return { flow, authorizationUrl }
  } catch (error) { await client.call(`/tool_router/session/${encodeURIComponent(sessionId)}`, 'DELETE').catch(() => {}); throw error }
}

export async function verifyOAuth(userId: string, flow: string) {
  const state = await readState(userId)
  const pending = state.pendingOAuth.find(item => item.id === flow)
  if (!pending) {
    const connected = state.settings.connections.find(connection => connection.id === flow && connection.kind === 'composio')
    if (connected) return { status: 'connected' as const }
    throw new HttpError(404, 'Sesi login tidak ditemukan. Mulai koneksi lagi.')
  }
  if (Date.now() - new Date(pending.createdAt).getTime() > 10 * 60_000) throw new HttpError(410, 'Sesi login kedaluwarsa. Hubungkan ulang.')
  const client = new ComposioClient(pending.apiKey)
  const account = await client.call(`/connected_accounts/${encodeURIComponent(pending.accountId)}`)
  if (['FAILED', 'EXPIRED', 'REVOKED', 'INACTIVE'].includes(String(account.status))) throw new HttpError(400, 'Login dibatalkan, ditolak, atau kedaluwarsa. Hubungkan ulang aplikasi.')
  if (account.status !== 'ACTIVE') return { status: 'pending' as const }
  if (!accountMatches(account, { accountId: pending.accountId, toolkit: pending.toolkit, userId: entityId(userId) })) throw new HttpError(403, 'Identitas akun OAuth tidak cocok dengan sesi login ini.')
  // The provider also verifies user ownership when pinning the account to the session.
  await client.call(`/tool_router/session/${encodeURIComponent(pending.sessionId)}`, 'PATCH', { connected_accounts: { [pending.toolkit]: [pending.accountId] }, manage_connections: { enable: false }, instant: false })
  const tools = await client.tools(pending.sessionId)
  if (!tools.length) throw new Error('Login berhasil, tetapi belum ada tools yang tersedia untuk aplikasi ini. Periksa konfigurasi toolkit di Composio.')
  const installed = await mutateState(userId, current => {
    if (!current.pendingOAuth.some(item => item.id === flow)) return current.settings.connections.some(item => item.id === flow && item.kind === 'composio')
    const connection: Connection = { id: flow, kind: 'composio', app: pending.app, name: OAUTH_APPS[pending.app].name, url: '', token: pending.apiKey, sessionId: pending.sessionId, accountId: pending.accountId, toolkit: pending.toolkit, toolCount: tools.length, status: 'connected' }
    current.settings.connections = current.settings.connections.filter(item => item.app !== pending.app).concat(connection)
    current.pendingOAuth = current.pendingOAuth.filter(item => item.id !== flow)
    return true
  })
  if (!installed) throw new HttpError(409, 'Login sudah dibatalkan. Hubungkan ulang jika diperlukan.')
  return { status: 'connected' as const }
}

export async function cancelOAuth(userId: string, flow: string) {
  const pending = (await readState(userId)).pendingOAuth.find(item => item.id === flow)
  if (!pending) return
  await new ComposioClient(pending.apiKey).call(`/tool_router/session/${encodeURIComponent(pending.sessionId)}`, 'DELETE').catch(() => {})
  await mutateState(userId, state => { state.pendingOAuth = state.pendingOAuth.filter(item => item.id !== flow) })
}

export async function disconnectOAuth(userId: string, id: string) {
  const connection = (await readState(userId)).settings.connections.find(item => item.id === id && item.kind === 'composio')
  if (!connection?.accountId) throw new HttpError(404, 'Koneksi OAuth tidak ditemukan.')
  const client = new ComposioClient(connection.token)
  await client.call(`/connected_accounts/${encodeURIComponent(connection.accountId)}/revoke`, 'POST', {})
  if (connection.sessionId) await client.call(`/tool_router/session/${encodeURIComponent(connection.sessionId)}`, 'DELETE').catch(() => {})
  await mutateState(userId, state => { state.settings.connections = state.settings.connections.filter(item => item.id !== id) })
}
