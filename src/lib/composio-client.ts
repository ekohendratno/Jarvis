export class ComposioClient {
  private key: string
  private request: typeof fetch
  constructor(key: string, request: typeof fetch = fetch) { this.key = key; this.request = request }
  async call(route: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!route.startsWith('/') || route.startsWith('//')) throw new Error('Endpoint koneksi tidak valid.')
    const response = await this.request(`https://backend.composio.dev/api/v3.1${route}`, {
      method, headers: { 'x-api-key': this.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
      redirect: 'error', cache: 'no-store',
    })
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Composio menolak akses. Periksa project API key dan izin Session management / Session tool execution.' : `Layanan koneksi gagal (HTTP ${response.status}). Coba ulangi atau periksa konfigurasi toolkit di Composio.`)
    if (response.status === 204) return {}
    return response.json()
  }
  async tools(sessionId: string) {
    const collected: { name: string; description: string; inputSchema: { type: 'object'; properties?: Record<string, unknown>; [key: string]: unknown } }[] = []
    const seen = new Set<string>()
    let cursor = ''
    do {
      const page = await this.call(`/tool_router/session/${encodeURIComponent(sessionId)}/tools?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
      if (!Array.isArray(page.items)) throw new Error('Layanan koneksi tidak mengembalikan daftar tools yang valid.')
      for (const item of page.items) {
        if (typeof item.slug === 'string' && item.input_parameters?.type === 'object') collected.push({ name: item.slug, description: String(item.description || item.name || item.slug), inputSchema: item.input_parameters })
      }
      cursor = typeof page.next_cursor === 'string' ? page.next_cursor : ''
      if (seen.has(cursor)) break
      seen.add(cursor)
    } while (cursor && collected.length < 200)
    return collected
  }
  async execute(sessionId: string, accountId: string, name: string, args: Record<string, unknown>) {
    const result = await this.call(`/tool_router/session/${encodeURIComponent(sessionId)}/execute`, 'POST', { tool_slug: name, arguments: args, account: accountId })
    return { isError: result.result_type !== 'completed', content: [{ type: 'text', text: JSON.stringify(result) }] }
  }
}
