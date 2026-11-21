import assert from 'node:assert/strict'
import test from 'node:test'
import { readChatCompletion } from '../src/lib/jarvis/provider-response.ts'

test('ordinary OpenAI JSON response', async () => {
  const message = await readChatCompletion(Response.json({ choices: [{ message: { content: 'Halo' } }] }))
  assert.equal(message.content, 'Halo')
})

test('normalizes common compatibility content blocks and Responses-style output', async () => {
  const blocks = await readChatCompletion(Response.json({ choices: [{ message: { content: [{ type: 'text', text: '# Judul\n' }, { type: 'text', text: '- satu' }] } }] }))
  assert.equal(blocks.content, '# Judul\n- satu')
  const responses = await readChatCompletion(Response.json({ output_text: '**Siap**' }))
  assert.equal(responses.content, '**Siap**')
})

test('reasoning-only token exhaustion explains the real failure', async () => {
  await assert.rejects(readChatCompletion(Response.json({ choices: [{ finish_reason: 'length', message: { content: null, reasoning: 'Thinking' } }] })), /Batas token habis/)
})

test('SSE text with comments, CRLF, usage packets and DONE', async () => {
  const body = ': keepalive\r\n\r\ndata: {"choices":[{"index":0,"delta":{"content":"Ha"}}]}\r\n\r\ndata: {"choices":[{"index":0,"delta":{"content":"lo"}}]}\r\n\r\ndata: {"choices":[],"usage":{"total_tokens":2}}\r\n\r\ndata: [DONE]\r\n\r\n'
  assert.equal((await readChatCompletion(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))).content, 'Halo')
})

test('SSE gateway without correct content type and fragmented tool arguments', async () => {
  const packets = [
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'write_', arguments: '{"filename":' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'note', arguments: '"test.md","content":"OK"}' } }] } }] },
  ]
  const body = packets.map(packet => `data: ${JSON.stringify(packet)}\n\n`).join('') + 'data: [DONE]\n\n'
  const message = await readChatCompletion(new Response(body))
  assert.equal(message.tool_calls[0].id, 'call-1')
  assert.equal(message.tool_calls[0].function.name, 'write_note')
  assert.deepEqual(JSON.parse(message.tool_calls[0].function.arguments), { filename: 'test.md', content: 'OK' })
})

test('rejects HTML, empty choices, empty stream, and provider errors clearly', async () => {
  await assert.rejects(readChatCompletion(new Response('<html>not an API</html>')), /Base URL/)
  await assert.rejects(readChatCompletion(Response.json({ choices: [] })), /choices/)
  await assert.rejects(readChatCompletion(new Response('data: [DONE]\n\n')), /choices/)
  await assert.rejects(readChatCompletion(new Response('data: {"error":{"message":"failed"}}\n\n')), /error saat streaming/)
})
