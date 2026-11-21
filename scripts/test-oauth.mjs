import test from 'node:test'
import assert from 'node:assert/strict'
import { ComposioClient } from '../src/lib/composio-client.ts'
import { accountMatches, safeAuthorizationUrl } from '../src/lib/oauth-apps.ts'

test('accepts only hosted authorization URLs from the configured vendor',()=>{
 assert.equal(safeAuthorizationUrl('https://app.composio.dev/link/lt_test'),'https://app.composio.dev/link/lt_test')
 for(const url of ['javascript:alert(1)','https://app.composio.dev.evil.test/login','http://app.composio.dev/link/x','https://user:pass@app.composio.dev/link/x'])assert.throws(()=>safeAuthorizationUrl(url))
})
test('connection activation requires active status and matching account, toolkit, user',()=>{
 const expected={accountId:'ca_test',toolkit:'googledrive',userId:'jarvis_test'}
 const account={id:'ca_test',toolkit:{slug:'googledrive'},user_id:'jarvis_test',status:'ACTIVE'}
 assert.equal(accountMatches(account,expected),true)
 assert.equal(accountMatches({...account,status:'INITIATED'},expected),false)
 assert.equal(accountMatches({...account,user_id:'other-user'},expected),false)
 assert.equal(accountMatches({...account,id:'ca_other'},expected),false)
 assert.equal(accountMatches({...account,toolkit:{slug:'gmail'}},expected),false)
 assert.equal(accountMatches({...account,is_disabled:true},expected),false)
})
test('paginated tool schemas and execution preserve provider outcomes',async()=>{
 const calls=[]
 const client=new ComposioClient('project-test-key',async(url,options)=>{
  calls.push({url,options})
  if(options.method==='POST')return Response.json({result_type:'blocked',message:'User approval required',data:{}})
  return Response.json({items:[{slug:url.includes('cursor=')?'DRIVE_READ':'DRIVE_LIST',description:'Read data',input_parameters:{type:'object',properties:{}}}],next_cursor:url.includes('cursor=')?null:'page-two'})
 })
 const tools=await client.tools('trs_test')
 assert.deepEqual(tools.map(tool=>tool.name),['DRIVE_LIST','DRIVE_READ'])
 const result=await client.execute('trs_test','ca_test','DRIVE_LIST',{})
 assert.equal(result.isError,true)
 assert.equal(JSON.parse(calls[2].options.body).account,'ca_test')
 assert.equal(calls[0].options.headers['x-api-key'],'project-test-key')
 assert.equal(calls[0].options.redirect,'error')
 assert.ok(calls.every(call=>call.url.startsWith('https://backend.composio.dev/api/v3.1/')))
})
test('successful tool result is explicitly required and key errors are sanitized',async()=>{
 const client=new ComposioClient('never-echo-secret',async()=>Response.json({result_type:'completed',data:{files:[]}}))
 assert.equal((await client.execute('trs_test','ca_test','DRIVE_LIST',{})).isError,false)
 const denied=new ComposioClient('never-echo-secret',async()=>Response.json({error:'never-echo-secret'},{status:401}))
 await assert.rejects(denied.call('/tool_router/session'),error=>!error.message.includes('never-echo-secret')&&error.message.includes('API key'))
})
