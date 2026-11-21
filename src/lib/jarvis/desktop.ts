import 'server-only'
import { execFile } from 'node:child_process'
import path from 'node:path'

export async function desktop(action: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (process.platform !== 'win32' || process.env.NODE_ENV !== 'development') throw new Error('Kontrol desktop tersedia pada server development Windows lokal.')
  const payload = Buffer.from(JSON.stringify(args)).toString('base64')
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', path.join(process.cwd(), 'scripts', 'desktop.ps1'), '-Action', action, '-Payload', payload],
      { windowsHide: true, timeout: 20_000, maxBuffer: 16 * 1024 * 1024, signal }, (error, stdout, stderr) => {
        if (error) { reject(new Error(stderr.trim().split('\n').slice(0, 2).join(' ') || error.message)); return }
        try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())) } catch { reject(new Error('Bridge desktop mengembalikan respons tidak valid.')) }
      })
  })
}
