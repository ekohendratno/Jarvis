// Local contract fixtures. Never used by the application or presented as a real provider.
import { createServer } from 'node:http'

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json')
  if (request.method !== 'POST') { response.writeHead(405).end(); return }
  let raw = ''
  for await (const chunk of request) { raw += chunk; if (raw.length > 2_000_000) { response.writeHead(413).end(); return } }
  const body = JSON.parse(raw || '{}')
  if (request.url === '/v1/chat/completions') {
    const last = body.messages.at(-1)
    const user = body.messages.findLast(message => message.role === 'user')
    const tool = body.messages.findLast(message => message.role === 'tool')
    if (String(user?.content).includes('slow fixture')) { await new Promise(resolve => setTimeout(resolve, 5000)) }
    let message
    if (tool) message = { role: 'assistant', content: `Contract fixture received tool result: ${tool.content}` }
    else if (String(last?.content).includes('Reply OK')) message = { role: 'assistant', content: 'OK' }
    else {
      const isMcp = String(user?.content).includes('MCP smoke test')
      const isNote = String(user?.content).includes('note smoke test')
      const isSearch = String(user?.content).includes('MCP search test')
      const isExecute = String(user?.content).includes('MCP execute test')
      const name = isSearch ? 'search_connected_tools' : isExecute ? 'run_connected_tool' : isMcp ? 'mcp_0_0' : isNote ? 'write_note' : 'get_time'
      const args = isSearch ? { query: 'echo', app: 'custom' } : isExecute ? { app: 'custom', tool: 'fixture_echo', arguments: { text: 'catalog-execution' } } : isMcp ? { text: 'hello-mcp' } : isNote ? { filename: 'contract-test.md', content: 'Created by a real tool call during the contract test.' } : {}
      message = { role: 'assistant', content: null, tool_calls: [{ id: 'fixture-call-1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] }
    }
    response.end(JSON.stringify({ id: 'fixture', choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }))
    return
  }
  if (request.url === '/mcp') {
    if (body.method === 'notifications/initialized' || !('id' in body)) { response.writeHead(202).end(); return }
    let result
    if (body.method === 'initialize') result = { protocolVersion: body.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'jarvis-contract-fixture', version: '1.0.0' } }
    else if (body.method === 'tools/list') result = { tools: [{ name: 'fixture_echo', description: 'Read-only test echo tool', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, annotations: { readOnlyHint: true } }] }
    else if (body.method === 'tools/call') result = { content: [{ type: 'text', text: `MCP echo: ${body.params.arguments.text}` }] }
    else { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })); return }
    response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }))
    return
  }
  response.writeHead(404).end('{}')
})
server.listen(4318, '127.0.0.1', () => console.log('Contract fixtures listening on http://127.0.0.1:4318 (OpenAI /v1 and MCP /mcp)'))
