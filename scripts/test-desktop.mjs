import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

if (process.platform !== 'win32') throw new Error('Windows is required for this test.')
const exec = promisify(execFile)
const script = path.resolve('scripts/desktop.ps1')
const run = async (action, args = {}) => {
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', script, '-Action', action, '-Payload', Buffer.from(JSON.stringify(args)).toString('base64')], { windowsHide: true, timeout: 20_000, maxBuffer: 16_000_000 })
  return JSON.parse(stdout)
}
await mkdir('.reference', { recursive: true })
const file = path.resolve('.reference/desktop-smoke.txt')
await writeFile(file, '')
const notepad = spawn('notepad.exe', [file], { stdio: 'ignore' })
const originalCursor = (await run('status')).cursor
try {
  let window
  for (let i = 0; i < 20; i++) {
    const status = await run('status')
    window = status.windows.find(w => w.Id === notepad.pid && w.MainWindowTitle.includes('desktop-smoke'))
    if (window) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(window, 'Dedicated test Notepad window must exist.')
  const focused = await run('focus_window', { id: window.Id })
  assert.equal(focused.ok, true)
  const current = (await run('status')).windows.find(w => w.Id === window.Id)
  const point = { x: current.bounds.x + 100, y: current.bounds.y + 100, click: true }
  const clicked = await run('pointer', point)
  assert.equal(clicked.clicked, true)
  await run('type_text', { text: 'Jarvis desktop test — suara dan komputer.\nUnicode: café.' })
  await run('key', { key: 'CTRL_S' })
  const text = await readFile(file, 'utf8')
  assert.ok(text.includes('Jarvis desktop test'))
  assert.ok(text.includes('café'))
  console.log('PASS: native focus, pointer movement/click, Unicode typing, shortcut, and saved file contents')
  const image = await run('screenshot')
  assert.ok(Buffer.from(image.image, 'base64').length > 1000)
  assert.ok(image.width > 0 && image.height > 0)
  console.log(`PASS: screenshot ${image.width}x${image.height}`)
} finally {
  await run('pointer', { ...originalCursor, click: false }).catch(() => {})
  if (notepad.pid) { try { process.kill(notepad.pid) } catch {} }
}
