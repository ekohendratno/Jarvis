type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type CompletionMessage = { content: string | null; tool_calls?: ToolCall[] }

function textFromContent(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  const parts = value.flatMap(part => {
    if (typeof part === 'string') return [part]
    if (!part || typeof part !== 'object') return []
    const block = part as { text?: unknown; content?: unknown; type?: unknown }
    if (typeof block.text === 'string') return [block.text]
    if (typeof block.content === 'string') return [block.content]
    if (block.type === 'text' && typeof block.content === 'string') return [block.content]
    return []
  })
  return parts.length ? parts.join('') : null
}

function normalizeMessage(message: unknown): CompletionMessage {
  if (!message || typeof message !== 'object') throw new Error('Respons provider tidak memiliki choices[0].message.')
  const value = message as { content?: unknown; output_text?: unknown; text?: unknown; tool_calls?: unknown }
  const content = textFromContent(value.content) ?? textFromContent(value.output_text) ?? textFromContent(value.text)
  const calls = Array.isArray(value.tool_calls) ? value.tool_calls.map((call, index) => {
    if (!call?.function || typeof call.function.name !== 'string' || !call.function.name) throw new Error('Provider mengirim tool call tanpa nama fungsi.')
    return {
      id: typeof call.id === 'string' && call.id ? call.id : `provider-tool-${index}`,
      type: 'function' as const,
      function: { name: call.function.name, arguments: typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments ?? {}) },
    }
  }) : []
  if (content === null && !calls.length) throw new Error('Provider mengirim respons kosong tanpa teks atau tool call.')
  return { content, ...(calls.length ? { tool_calls: calls } : {}) }
}

/** Some compatibility gateways return SSE even when stream:false is requested. */
export async function readChatCompletion(response: Response): Promise<CompletionMessage> {
  const text = await response.text()
  if (!text.trim()) throw new Error('Provider mengirim respons kosong.')
  const isSse = response.headers.get('content-type')?.includes('text/event-stream') || /^(?:data:|:)/.test(text.trimStart())
  if (!isSse) {
    let body
    try { body = JSON.parse(text) } catch { throw new Error('Provider mengirim respons selain JSON/SSE. Periksa Base URL dan endpoint /chat/completions.') }
    if (body.error) throw new Error('Provider mengembalikan error. Periksa API key, model, dan kuota.')
    const choice = body.choices?.[0]
    if (choice?.finish_reason === 'length' && !choice.message?.content && !choice.message?.tool_calls?.length) {
      throw new Error('Batas token habis sebelum model menghasilkan jawaban. Naikkan batas output atau gunakan model tanpa reasoning untuk uji koneksi.')
    }
    if (choice?.message) return normalizeMessage(choice.message)
    // Some OpenAI-compatible gateways expose a Responses-style body despite using chat/completions.
    if (body.output_text === undefined && body.output === undefined && body.content === undefined && body.text === undefined) throw new Error('Respons provider tidak memiliki choices[0].message.')
    return normalizeMessage({ content: body.output_text ?? body.output ?? body.content ?? body.text, tool_calls: body.tool_calls })
  }
  let content = ''
  let foundChoice = false
  const calls = new Map<number, ToolCall>()
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim()
    if (!data || data === '[DONE]') continue
    let payload
    try { payload = JSON.parse(data) } catch { throw new Error('Stream provider berisi event JSON tidak valid. Coba ulangi permintaan.') }
    if (payload.error) throw new Error('Provider mengembalikan error saat streaming. Periksa model dan kuota.')
    const choice = payload.choices?.find((item: { index?: number }) => item.index === 0 || item.index === undefined)
    if (!choice) continue
    foundChoice = true
    const delta = choice.delta || choice.message || {}
    const deltaText = textFromContent(delta.content) ?? textFromContent(delta.text)
    if (deltaText) content += deltaText
    for (const [position, part] of (delta.tool_calls || []).entries()) {
      const index = Number.isInteger(part.index) ? part.index : position
      const call = calls.get(index) || { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      if (typeof part.id === 'string' && part.id) call.id = part.id
      if (typeof part.function?.name === 'string') call.function.name += part.function.name
      if (typeof part.function?.arguments === 'string') call.function.arguments += part.function.arguments
      calls.set(index, call)
    }
  }
  if (!foundChoice) throw new Error('Stream provider tidak memiliki choices yang dapat dibaca.')
  return normalizeMessage({ content: content || null, tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call) })
}
