import 'server-only'
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { desktop } from '@/lib/jarvis/desktop'
import { userRoot } from '@/lib/jarvis/storage'
import type { Settings } from '@/types/jarvis'

type Definition = { name: string; description: string; parameters: Record<string, unknown> }
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
const str = (description: string) => ({ type: 'string', description })
export const localTools: Definition[] = [
  { name: 'get_time', description: 'Get current time/date in Asia/Jakarta.', parameters: object({}) },
  { name: 'list_notes', description: 'List files in the Jarvis user notes workspace.', parameters: object({}) },
  { name: 'read_note', description: 'Read a Jarvis note by filename.', parameters: object({ filename: str('Plain filename including .txt or .md') }, ['filename']) },
  { name: 'write_note', description: 'Create or update a note inside the Jarvis workspace.', parameters: object({ filename: str('Plain filename ending .txt or .md'), content: str('Full note contents') }, ['filename', 'content']) },
  { name: 'desktop_status', description: 'List open Windows applications and screen bounds.', parameters: object({}) },
  { name: 'desktop_screenshot', description: 'Capture the desktop. Read actual coordinates before clicking. Image is sent to the vision-capable model.', parameters: object({}) },
  { name: 'desktop_open_app', description: 'Open a local app. Allowed: notepad, calculator, explorer, edge, chrome, vscode, paint, terminal, spotify.', parameters: object({ app: str('Allowed application name') }, ['app']) },
  { name: 'desktop_open_url', description: 'Open an http(s) website in the default browser.', parameters: object({ url: str('Full URL') }, ['url']) },
  { name: 'desktop_pointer', description: 'Move pointer to an observed screen coordinate, optionally left-click.', parameters: object({ x: { type: 'integer' }, y: { type: 'integer' }, click: { type: 'boolean' } }, ['x', 'y', 'click']) },
  { name: 'desktop_focus_window', description: 'Focus an existing window by its process ID from desktop_status.', parameters: object({ id: { type: 'integer' } }, ['id']) },
  { name: 'desktop_type_text', description: 'Paste literal Unicode text into the focused window. Never use this to enter shell commands or execute code.', parameters: object({ text: str('Literal text to paste') }, ['text']) },
  { name: 'desktop_key', description: 'Press an allowed key: WIN (opens Start menu; search installed apps with desktop_type_text), ENTER TAB ESC BACKSPACE UP DOWN LEFT RIGHT CTRL_A CTRL_C CTRL_V CTRL_S CTRL_L CTRL_Z ALT_TAB PAGE_DOWN PAGE_UP.', parameters: object({ key: str('Allowed key name') }, ['key']) },
]

export function notePath(userId: string, filename: string) {
  const name = z.string().min(1).max(100).regex(/^[\p{L}\p{N}_ -]+\.(txt|md)$/u, 'Nama file harus .txt atau .md, tanpa folder.').parse(filename)
  return path.join(userRoot(userId), 'notes', name)
}

export async function runLocalTool(userId: string, settings: Settings, name: string, args: Record<string, unknown>, signal?: AbortSignal) {
  if (name === 'get_time') return { time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }), timezone: 'Asia/Jakarta' }
  if (name === 'list_notes') {
    const folder = path.join(userRoot(userId), 'notes')
    await fs.mkdir(folder, { recursive: true })
    return { files: await fs.readdir(folder) }
  }
  if (name === 'read_note') return { filename: args.filename, content: await fs.readFile(notePath(userId, String(args.filename)), 'utf8') }
  if (name === 'write_note') {
    const content = z.string().max(100_000).parse(args.content)
    const file = notePath(userId, String(args.filename))
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content, 'utf8')
    return { ok: true, filename: args.filename }
  }
  if (!settings.desktopEnabled) throw new Error('Aktifkan Kontrol komputer di halaman Assistant terlebih dahulu.')
  const action = name.replace(/^desktop_/, '')
  const schemas: Record<string, z.ZodTypeAny> = {
    status: z.object({}), screenshot: z.object({}),
    open_app: z.object({ app: z.enum(['notepad', 'calculator', 'explorer', 'edge', 'chrome', 'vscode', 'paint', 'terminal', 'spotify']) }),
    open_url: z.object({ url: z.string().url().refine(url => /^https?:\/\//i.test(url)) }),
    pointer: z.object({ x: z.number().int().min(-20000).max(20000), y: z.number().int().min(-20000).max(20000), click: z.boolean() }),
    focus_window: z.object({ id: z.number().int().positive() }),
    type_text: z.object({ text: z.string().min(1).max(5000) }),
    key: z.object({ key: z.enum(['WIN','ENTER','TAB','ESC','BACKSPACE','UP','DOWN','LEFT','RIGHT','CTRL_A','CTRL_C','CTRL_V','CTRL_S','CTRL_L','CTRL_Z','ALT_TAB','PAGE_DOWN','PAGE_UP']) }),
  }
  if (!schemas[action]) throw new Error('Tool tidak dikenal.')
  return desktop(action, schemas[action].parse(args) as Record<string, unknown>, signal)
}
