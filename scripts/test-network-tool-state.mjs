import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('tool events carry an app target for the network signal', async () => {
  const route = await readFile(new URL('../src/app/api/jarvis/agent/route.ts', import.meta.url), 'utf8')
  const network = await readFile(new URL('../src/components/jarvis/neural-network.tsx', import.meta.url), 'utf8')
  assert.match(route, /app, detail: 'Menjalankan/)
  assert.match(network, /activeApp === app\.id/)
  assert.match(network, /edge signal/)
})
