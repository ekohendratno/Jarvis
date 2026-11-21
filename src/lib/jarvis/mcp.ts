import 'server-only'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Connection } from '@/types/jarvis'
import { ComposioClient } from '@/lib/composio-client'

export async function withMcp<T>(connection: Pick<Connection, 'url' | 'token'>, run: (client: Client) => Promise<T>): Promise<T> {
  const url = new URL(connection.url)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Gunakan URL MCP HTTP/HTTPS tanpa username/password di URL.')
  const client = new Client({ name: 'jarvis-local', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: connection.token ? { Authorization: `Bearer ${connection.token}` } : {}, signal: AbortSignal.timeout(20_000), redirect: 'error' },
  })
  try { await client.connect(transport); return await run(client) } finally { await client.close().catch(() => {}) }
}

export async function inspectConnection(connection: Pick<Connection, 'url' | 'token' | 'kind' | 'sessionId'>) {
  if (connection.kind === 'composio') {
    if (!connection.sessionId) throw new Error('Sesi aplikasi tidak valid. Hubungkan ulang melalui browser.')
    return new ComposioClient(connection.token).tools(connection.sessionId)
  }
  return withMcp(connection, async client => {
    const result = await client.listTools()
    const tools = [...result.tools]
    let cursor = result.nextCursor
    const seen = new Set<string>()
    while (cursor && tools.length < 200 && !seen.has(cursor)) {
      seen.add(cursor)
      const page = await client.listTools({ cursor })
      tools.push(...page.tools)
      cursor = page.nextCursor
    }
    return tools
  })
}

export async function executeConnection(connection: Connection, name: string, args: Record<string, unknown>) {
  if (connection.kind === 'composio') {
    if (!connection.sessionId || !connection.accountId) throw new Error('Sesi aplikasi tidak valid. Hubungkan ulang.')
    return new ComposioClient(connection.token).execute(connection.sessionId, connection.accountId, name, args)
  }
  return withMcp(connection, client => client.callTool({ name, arguments: args }))
}
