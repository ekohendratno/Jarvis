import test from 'node:test'
import assert from 'node:assert/strict'
import { inferProvider, isLocalEndpoint, parseModels, providerKey } from '../src/lib/ai-providers.ts'

test('infer existing endpoints without resetting custom addresses',()=>{
 assert.equal(inferProvider('http://localhost:20128/v1/'),'9router')
 assert.equal(inferProvider('https://example.test/custom/v1'),'custom')
 assert.equal(isLocalEndpoint('http://127.0.0.1:11434/v1'),true)
 assert.equal(isLocalEndpoint('https://localhost.attacker.test/v1'),false)
})
test('a saved secret is reused only for its original endpoint',()=>{
 const saved={baseUrl:'http://localhost:20128/v1',apiKey:'private-test-key'}
 assert.equal(providerKey(saved,saved.baseUrl+'/',''),'private-test-key')
 assert.equal(providerKey(saved,'https://example.test/v1',''),'')
 assert.equal(providerKey(saved,'http://localhost:20129/v1',''),'')
 assert.equal(providerKey(saved,'https://example.test/v1','new-key'),'new-key')
 assert.equal(providerKey(saved,saved.baseUrl,'',true),'')
})
test('model discovery validates, deduplicates, preserves aliases and names',()=>{
 const models=parseModels({data:[{id:'ngoding'},{id:'asistent',name:'Asisten'},null,{id:''},{id:42},{id:'ngoding'}]})
 assert.deepEqual(models,[{id:'asistent',name:'Asisten'},{id:'ngoding',name:'ngoding'}])
 assert.deepEqual(parseModels({data:[]}),[])
 assert.throws(()=>parseModels({models:[]}),/manual/)
})
