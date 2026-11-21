export const AI_PROVIDERS = [
  { id: '9router', name: '9router', baseUrl: 'http://localhost:20128/v1' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { id: 'ollama', name: 'Ollama · lokal', baseUrl: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio · lokal', baseUrl: 'http://localhost:1234/v1' },
  { id: 'custom', name: 'Custom OpenAI-compatible', baseUrl: '' },
] as const
export type ProviderId = typeof AI_PROVIDERS[number]['id']
export function normalizedEndpoint(value: string) { try { return new URL(value).toString().replace(/\/+$/, '') } catch { return '' } }
export function sameEndpoint(a: string, b: string) { return !!normalizedEndpoint(a) && normalizedEndpoint(a) === normalizedEndpoint(b) }
export function inferProvider(baseUrl: string): ProviderId { return AI_PROVIDERS.find(provider => provider.baseUrl && sameEndpoint(provider.baseUrl, baseUrl))?.id || 'custom' }
export function isLocalEndpoint(value: string) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) } catch { return false } }
export function providerKey(saved: { baseUrl: string; apiKey: string }, baseUrl: string, typedKey?: string, clear = false) {
  return clear ? '' : typedKey?.trim() || (sameEndpoint(saved.baseUrl, baseUrl) ? saved.apiKey : '')
}
export function parseModels(body: unknown): { id: string; name: string }[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) throw new Error('Provider tidak mengirim daftar model OpenAI-compatible. Isi model manual.')
  const result = new Map<string, { id: string; name: string }>()
  for (const item of (body as { data: unknown[] }).data.slice(0, 5000)) {
    if (!item || typeof item !== 'object') continue
    const value = item as { id?: unknown; name?: unknown }
    if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 300) continue
    result.set(value.id, { id: value.id, name: typeof value.name === 'string' ? value.name.slice(0, 300) : value.id })
  }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id))
}
