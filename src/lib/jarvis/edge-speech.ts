import 'server-only'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { EDGE_VOICES } from '@/lib/voice-options'
import { HttpError } from './auth'

export const speechSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voice: z.string().refine(value => EDGE_VOICES.some(voice => voice.id === value), 'Voice tidak didukung.'),
  rate: z.number().int().min(-30).max(50), pitch: z.number().int().min(-30).max(30), volume: z.number().int().min(-50).max(0),
})
type Ticket = { userId: string; created: number; input: z.infer<typeof speechSchema> }
const speechGlobal = globalThis as typeof globalThis & { jarvisSpeechTickets?: Map<string, Ticket>; jarvisSpeechJobs?: Map<string, { userId: string; stop: () => void }> }
const tickets = speechGlobal.jarvisSpeechTickets ??= new Map<string, Ticket>()
const jobs = speechGlobal.jarvisSpeechJobs ??= new Map<string, { userId: string; stop: () => void }>()

function pythonPath() {
  return process.env.JARVIS_TTS_PYTHON || path.join(process.cwd(), '.venv-tts', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
}
export async function edgeAvailable() { try { await access(pythonPath()); return true } catch { return false } }
function expire() { for (const [id, ticket] of tickets) if (Date.now() - ticket.created > 60_000) tickets.delete(id) }
export async function createSpeechTicket(userId: string, input: unknown) {
  const parsed = speechSchema.parse(input)
  if (!await edgeAvailable()) throw new HttpError(503, 'Edge TTS belum terpasang. Jalankan setup TTS sesuai JARVIS.md atau pilih Browser.')
  expire()
  if ([...tickets.values()].filter(ticket => ticket.userId === userId).length >= 3) throw new HttpError(429, 'Terlalu banyak permintaan suara. Hentikan preview sebelumnya.')
  const id = randomUUID()
  tickets.set(id, { userId, created: Date.now(), input: parsed })
  return id
}
export function stopSpeechTicket(userId: string, id: string) {
  if (tickets.get(id)?.userId === userId) tickets.delete(id)
  if (jobs.get(id)?.userId === userId) jobs.get(id)?.stop()
}

export async function speechResponse(userId: string, id: string, signal: AbortSignal): Promise<Response> {
  expire()
  const ticket = tickets.get(id)
  if (!ticket || ticket.userId !== userId) throw new HttpError(404, 'Audio sudah kedaluwarsa atau dibatalkan. Coba lagi.')
  if ([...jobs.values()].filter(job => job.userId === userId).length >= 2) throw new HttpError(429, 'Suara sebelumnya masih diproses. Tunggu sebentar.')
  tickets.delete(id)
  if (signal.aborted) throw new HttpError(499, 'Pemutaran dibatalkan.')
  const child = spawn(pythonPath(), ['-u', path.join(process.cwd(), 'scripts/edge-speech.py')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONUTF8: '1' } })
  const started = Date.now()
  let closed = false
  let timedOut = false
  let errorText = ''
  let firstAudio = false
  let controller: ReadableStreamDefaultController<Uint8Array>
  let readyResolve: () => void
  let readyReject: (error: Error) => void
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  const stop = () => {
    if (closed) return
    closed = true
    child.kill()
    readyReject(new Error('Pemutaran suara dibatalkan.'))
    try { controller.close() } catch {}
  }
  let timer = setTimeout(() => { timedOut = true; child.kill() }, 60_000)
  const stream = new ReadableStream<Uint8Array>({
    start(value) { controller = value },
    pull() { child.stdout.resume() },
    cancel() { stop() },
  })
  jobs.set(id, { userId, stop })
  signal.addEventListener('abort', stop, { once: true })
  child.stderr.on('data', data => { errorText = (errorText + data.toString()).slice(-1500) })
  child.stdout.on('data', data => {
    if (closed) return
    if (!firstAudio) {
      firstAudio = true
      clearTimeout(timer)
      timer = setTimeout(() => { timedOut = true; child.kill() }, 600_000)
      readyResolve()
    }
    controller.enqueue(new Uint8Array(data))
    if ((controller.desiredSize || 0) <= 0) child.stdout.pause()
  })
  child.on('error', () => { readyReject(new Error('Python Edge TTS tidak dapat dijalankan. Periksa instalasi TTS.')); stop() })
  child.on('close', code => {
    clearTimeout(timer); jobs.delete(id); signal.removeEventListener('abort', stop)
    if (closed) return
    closed = true
    if (code !== 0 || !firstAudio) {
      const message = timedOut ? 'Edge TTS melewati batas waktu. Periksa koneksi internet.' : errorText.includes('ModuleNotFoundError') ? 'Paket edge-tts belum terpasang di Python TTS.' : 'Edge TTS gagal menghasilkan audio. Periksa internet lalu coba lagi, atau gunakan Browser.'
      readyReject(new Error(message))
      controller.error(new Error(message))
    } else controller.close()
  })
  child.stdin.on('error', () => {})
  child.stdin.end(JSON.stringify(ticket.input))
  await ready
  return new Response(stream, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no', 'Server-Timing': `tts-first-byte;dur=${Date.now() - started}` } })
}
