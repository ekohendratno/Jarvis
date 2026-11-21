import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('assistant renderer supports GFM and keeps raw provider HTML disabled', async () => {
  const source = await readFile(new URL('../src/components/jarvis/assistant-message.tsx', import.meta.url), 'utf8')
  assert.match(source, /remarkGfm/)
  assert.match(source, /ReactMarkdown/)
  assert.doesNotMatch(source, /rehypeRaw/)
})
