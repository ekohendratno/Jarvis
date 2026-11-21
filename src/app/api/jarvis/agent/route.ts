import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requireUser, apiError, HttpError } from '@/lib/jarvis/auth'
import { mutateState, readState } from '@/lib/jarvis/storage'
import { inspectConnection, executeConnection } from '@/lib/jarvis/mcp'
import { localTools, runLocalTool } from '@/ai/tools'
import type { AgentEvent, RunArtifact, RunStep, Settings } from '@/types/jarvis'
import { readChatCompletion } from '@/lib/jarvis/provider-response'
import { isLocalEndpoint } from '@/lib/ai-providers'
import { responseLanguageInstruction } from '@/lib/response-language'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const agentGlobal = globalThis as typeof globalThis & { jarvisRunningAgents?: Set<string> }
const running = agentGlobal.jarvisRunningAgents ??= new Set<string>()
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type ModelMessage = { role: string; content: unknown; tool_calls?: ToolCall[]; tool_call_id?: string }

function offlineCommand(command: string): { name: string; args: Record<string, unknown> } | null {
  if (/^(jam berapa|tanggal berapa|waktu sekarang|what time|current time)/i.test(command)) return { name: 'get_time', args: {} }
  if (/^(status komputer|computer status|daftar (aplikasi|window))/i.test(command)) return { name: 'desktop_status', args: {} }
  if (/^(lihat|daftar|list) (file|catatan|notes)/i.test(command)) return { name: 'list_notes', args: {} }
  const apps: Record<string, string> = { kalkulator: 'calculator', calculator: 'calculator', notepad: 'notepad', explorer: 'explorer', chrome: 'chrome', edge: 'edge', paint: 'paint', spotify: 'spotify', vscode: 'vscode' }
  const match = command.match(/^(?:buka|open)\s+(\w+)[.!]?$/i)
  if (match && apps[match[1].toLowerCase()]) return { name: 'desktop_open_app', args: { app: apps[match[1].toLowerCase()] } }
  return null
}

function commandNeedsApproval(command: string) {
  return /\b(kirim|send|buat|create|hapus|delete|jadwalkan|schedule|post|publish|ubah|update|draft|tulis|write|upload|simpan|save|tambahkan|add|pindahkan|move|bagikan|share)\b/i.test(command)
}

async function model(settings: Settings, messages: ModelMessage[], tools: unknown[], signal: AbortSignal) {
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({ model: settings.model, messages, stream: false, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]), redirect: 'error',
  })
  if (!response.ok) throw new Error(`Provider AI gagal (HTTP ${response.status}). Periksa API key, kuota, model, dan dukungan tool calling di Assistant.`)
  return readChatCompletion(response)
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const input = z.object({ command: z.string().trim().min(1).max(8000), conversationId: z.string().uuid().optional(), approved: z.boolean().optional(), plan: z.array(z.string().min(1).max(180)).max(6).optional() }).parse(await request.json())
    if (commandNeedsApproval(input.command) && !input.approved) throw new HttpError(409, 'Tinjau rencana dan berikan persetujuan spesifik sebelum tindakan eksternal dijalankan.')
    if (running.has(user.id)) throw new HttpError(409, 'Jarvis masih mengerjakan perintah sebelumnya. Hentikan atau tunggu hingga selesai.')
    running.add(user.id)
    let state
    try { state = await readState(user.id) } catch (error) { running.delete(user.id); throw error }
    const conversationId = input.conversationId || randomUUID()
    const runId = randomUUID()
    const history = state.conversations.find(c => c.id === conversationId)?.messages || []
    try {
      const plannedSteps: RunStep[] = (input.plan?.length ? input.plan : ['Memahami permintaan dan memilih kemampuan yang diperlukan']).map((label, index) => ({ id: `plan-${index}`, label, status: 'planned' }))
      await mutateState(user.id, current => {
        let conversation = current.conversations.find(c => c.id === conversationId)
        if (!conversation) { conversation = { id: conversationId, title: input.command.slice(0, 65), messages: [], updatedAt: new Date().toISOString() }; current.conversations.unshift(conversation) }
        conversation.messages.push({ role: 'user', content: input.command, createdAt: new Date().toISOString() })
        conversation.messages = conversation.messages.slice(-200)
        conversation.updatedAt = new Date().toISOString()
        current.conversations = current.conversations.slice(0, 100)
        current.runs.unshift({ id: runId, command: input.command, status: 'running', approval: input.approved ? 'approved' : 'not-required', steps: plannedSteps, artifacts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        current.runs = current.runs.slice(0, 80)
      })
    } catch (error) { running.delete(user.id); throw error }
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false
        const emit = (event: AgentEvent) => { if (!closed) try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')) } catch { closed = true } }
        let answer = ''
        try {
          emit({ type: 'conversation', id: conversationId })
          emit({ type: 'run', runId })
          const settings = state.settings
          const execute = async (name: string, args: Record<string, unknown>, run: () => Promise<unknown>, app?: string) => {
            if (request.signal.aborted) throw new Error('Perintah dihentikan.')
            const stepId = randomUUID()
            await mutateState(user.id, current => {
              const task = current.runs.find(item => item.id === runId)
              if (!task) return
              task.steps.push({ id: stepId, label: name, app, status: 'running', detail: 'Menjalankan…', startedAt: new Date().toISOString() })
              task.updatedAt = new Date().toISOString()
            })
            emit({ type: 'tool', name, app, detail: 'Menjalankan…' })
            try {
              const result = await run()
              if (result && typeof result === 'object' && 'isError' in result && result.isError) throw new Error(JSON.stringify(result).slice(0, 1000))
              emit({ type: 'tool', name, app, status: 'success', detail: 'Selesai' })
              await mutateState(user.id, current => {
                current.activities.unshift({ id: randomUUID(), name, detail: JSON.stringify(args).slice(0, 200), status: 'success', createdAt: new Date().toISOString() }); current.activities = current.activities.slice(0, 200)
                const task = current.runs.find(item => item.id === runId)
                if (task) {
                  const step = task.steps.find(item => item.id === stepId)
                  if (step) Object.assign(step, { status: 'success', detail: 'Selesai', finishedAt: new Date().toISOString() })
                  const raw = JSON.stringify(result ?? {})
                  const urls = raw.match(/https?:\/\/[^\"\s]+/g)?.slice(0, 3) || []
                  const artifacts: RunArtifact[] = urls.map((url, index) => ({ label: `${name} · hasil ${index + 1}`, url }))
                  task.artifacts = [...task.artifacts, ...artifacts].slice(0, 10)
                  task.updatedAt = new Date().toISOString()
                }
              })
              return result
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'Tool gagal.'
              emit({ type: 'tool', name, app, status: 'error', detail })
              await mutateState(user.id, current => {
                current.activities.unshift({ id: randomUUID(), name, detail, status: 'error', createdAt: new Date().toISOString() }); current.activities = current.activities.slice(0, 200)
                const task = current.runs.find(item => item.id === runId)
                if (task) { const step = task.steps.find(item => item.id === stepId); if (step) Object.assign(step, { status: 'error', detail, finishedAt: new Date().toISOString() }); task.updatedAt = new Date().toISOString() }
              })
              return { error: detail }
            }
          }
          if (!settings.apiKey && !isLocalEndpoint(settings.baseUrl)) {
            const direct = offlineCommand(input.command)
            if (direct) {
              const result = await execute(direct.name, direct.args, () => runLocalTool(user.id, settings, direct.name, direct.args, request.signal))
              const output = result as Record<string, unknown>
              if (output.error) answer = String(output.error)
              else if (direct.name === 'get_time') answer = `Sekarang ${output.time} WIB.`
              else if (direct.name === 'desktop_open_app') answer = `${String(direct.args.app).replace('calculator', 'Kalkulator')} sudah dibuka.`
              else if (direct.name === 'list_notes') {
                const files = output.files as string[]
                answer = files.length ? `Catatan Anda:\n${files.map(file => `• ${file}`).join('\n')}` : 'Belum ada catatan. Buat catatan pertama melalui halaman Files.'
              } else {
                const windows = output.windows as { MainWindowTitle: string }[]
                answer = `Ada ${windows.length} jendela aplikasi terbuka:\n${windows.map(window => `• ${window.MainWindowTitle}`).join('\n')}`
              }
            } else answer = 'Hubungkan mesin AI di Assistant: isi Base URL, API key, dan model, lalu klik Simpan dan Uji koneksi. Perintah lokal yang sudah tersedia tanpa API key: “jam berapa”, “lihat catatan”, “status komputer”, dan “buka kalkulator” (aktifkan kontrol komputer terlebih dahulu).'
          } else {
            const enabledTools = localTools.filter(tool => settings.desktopEnabled || !tool.name.startsWith('desktop_'))
            const tools: unknown[] = enabledTools.map(tool => ({ type: 'function', function: tool }))
            const remote = new Map<string, { connection: Settings['connections'][number]; originalName: string }>()
            const catalog: { connection: Settings['connections'][number]; name: string; description?: string; inputSchema: unknown }[] = []
            for (const [index, connection] of settings.connections.entries()) {
              try {
                const discovered = await inspectConnection(connection)
                catalog.push(...discovered.map(tool => ({ connection, name: tool.name, description: tool.description, inputSchema: tool.inputSchema })))
                for (const [toolIndex, tool] of discovered.slice(0, 3).entries()) {
                  const name = `mcp_${index}_${toolIndex}`
                  remote.set(name, { connection, originalName: tool.name })
                  tools.push({ type: 'function', function: { name, description: `${connection.name}: ${tool.name}. ${tool.description || ''}`.slice(0, 1800), parameters: tool.inputSchema } })
                }
              } catch { emit({ type: 'tool', name: connection.name, status: 'error', detail: 'Koneksi MCP tidak tersedia. Sambungkan ulang di Connections.' }) }
            }
            if (catalog.length) tools.push(
              { type: 'function', function: { name: 'search_connected_tools', description: `Discover tools and their argument schemas across connected apps: ${settings.connections.map(c => `${c.app} (${c.name})`).join(', ')}. Search using English tool keywords. Use this when a required app action is not directly listed.`, parameters: { type: 'object', properties: { query: { type: 'string' }, app: { type: 'string', description: 'Optional app ID, or empty to search all apps.' } }, required: ['query'], additionalProperties: false } } },
              { type: 'function', function: { name: 'run_connected_tool', description: 'Execute a discovered tool using its exact app ID, tool name, and JSON arguments matching its discovered schema.', parameters: { type: 'object', properties: { app: { type: 'string' }, tool: { type: 'string' }, arguments: { type: 'object', additionalProperties: true } }, required: ['app', 'tool', 'arguments'], additionalProperties: false } } },
            )
            const messages: ModelMessage[] = [{ role: 'system', content: `${settings.systemPrompt}\n${responseLanguageInstruction(settings.language)}\nWaktu: ${new Date().toISOString()}. Computer control: ${settings.desktopEnabled}. Untuk tugas komputer, amati desktop_status dan screenshot sebelum klik, cocokkan koordinat absolut dengan bounds screenshot. Jangan menulis atau menjalankan shell/code lewat UI. Sebelum tindakan yang mengirim, membeli, menghapus, atau mengubah akses, tanyakan konfirmasi spesifik pengguna. Maksimal 8 putaran tools; laporkan kegagalan tanpa mengklaim berhasil.` }, ...history.slice(-24).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: input.command }]
            for (let round = 0; round < 8; round++) {
              const response = await model(settings, messages, tools.slice(0, 120), request.signal)
              if (!response.tool_calls?.length) { answer = response.content || 'Selesai.'; break }
              if (response.tool_calls.length > 10) throw new Error('Model meminta terlalu banyak tindakan sekaligus. Pecah perintah menjadi tugas yang lebih kecil.')
              messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls })
              const images: string[] = []
              for (const call of response.tool_calls) {
                const args = JSON.parse(call.function.arguments || '{}')
                let target = remote.get(call.function.name)
                let toolArgs = args
                if (call.function.name === 'run_connected_tool') {
                  const input = z.object({ app: z.string(), tool: z.string(), arguments: z.record(z.string(), z.unknown()) }).parse(args)
                  const found = catalog.find(tool => tool.connection.app === input.app && tool.name === input.tool)
                  if (!found) throw new Error('Tool aplikasi tidak ditemukan. Gunakan search_connected_tools terlebih dahulu.')
                  target = { connection: found.connection, originalName: found.name }
                  toolArgs = input.arguments
                }
                const selectedTarget = target
                const result = await execute(target ? `${target.connection.name}: ${target.originalName}` : call.function.name, toolArgs, async () => {
                  if (call.function.name === 'search_connected_tools') {
                    const search = z.object({ query: z.string().max(500), app: z.string().optional() }).parse(args)
                    const keywords = search.query.toLowerCase().split(/\s+/).filter(Boolean)
                    return catalog.filter(tool => !search.app || tool.connection.app === search.app)
                      .map(tool => ({ tool, score: keywords.reduce((sum, word) => sum + (tool.name + ' ' + tool.description).toLowerCase().split(word).length - 1, 0) }))
                      .sort((a, b) => b.score - a.score).slice(0, 12)
                      .map(({ tool }) => ({ app: tool.connection.app, tool: tool.name, description: tool.description, argumentsSchema: tool.inputSchema }))
                  }
                  return selectedTarget
                    ? executeConnection(selectedTarget.connection, selectedTarget.originalName, toolArgs)
                    : runLocalTool(user.id, settings, call.function.name, args, request.signal)
                }, target?.connection.app)
                if (result && typeof result === 'object' && 'image' in result && typeof result.image === 'string') {
                  images.push(result.image)
                  const { image: omitted, ...metadata } = result
                  void omitted
                  messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(metadata) })
                } else messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 40_000) })
              }
              if (images.length) messages.push({ role: 'user', content: images.map(image => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } })) })
              if (round === 7) answer = 'Batas 8 langkah tercapai. Periksa Activity untuk hasil tindakan, lalu lanjutkan dengan instruksi berikutnya.'
            }
          }
          await mutateState(user.id, current => {
            const conversation = current.conversations.find(c => c.id === conversationId)
            if (conversation) {
              conversation.messages.push({ role: 'assistant', content: answer, createdAt: new Date().toISOString() })
              conversation.messages = conversation.messages.slice(-200)
              conversation.updatedAt = new Date().toISOString()
            }
            const task = current.runs.find(item => item.id === runId)
            if (task) { task.status = 'completed'; task.summary = answer; task.updatedAt = new Date().toISOString() }
          })
          emit({ type: 'answer', content: answer })
        } catch (error) {
          await mutateState(user.id, current => { const task = current.runs.find(item => item.id === runId); if (task) { task.status = request.signal.aborted ? 'stopped' : 'failed'; task.summary = request.signal.aborted ? 'Perintah dihentikan.' : error instanceof Error ? error.message : 'Perintah gagal.'; task.updatedAt = new Date().toISOString() } }).catch(() => {})
          emit({ type: 'error', content: request.signal.aborted ? 'Perintah dihentikan.' : error instanceof Error ? error.message : 'Perintah gagal.' })
        } finally {
          running.delete(user.id)
          emit({ type: 'done' })
          if (!closed) { closed = true; controller.close() }
        }
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
  } catch (error) { return apiError(error) }
}
