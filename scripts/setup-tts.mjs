import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const environment = path.join(root, '.venv-tts')
const python = path.join(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
try {
  if (!existsSync(python)) execFileSync(process.env.JARVIS_SETUP_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'venv', environment], { cwd: root, stdio: 'inherit', windowsHide: true })
  execFileSync(python, ['-m', 'pip', 'install', '-r', path.join(root, 'scripts/requirements-tts.txt')], { cwd: root, stdio: 'inherit', windowsHide: true })
  console.log('Edge TTS ready. Open Assistant → Voice & language → Coba suara.')
} catch {
  console.error('TTS setup failed. Install Python 3.10+, or set JARVIS_SETUP_PYTHON to its executable and retry npm run setup:tts.')
  process.exitCode = 1
}
