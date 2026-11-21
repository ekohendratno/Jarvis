import test from 'node:test'
import assert from 'node:assert/strict'
import { EdgeSpeechPlayback } from '../src/lib/edge-playback.ts'
const options={speechProvider:'edge',speechVoice:'id-ID-ArdiNeural',browserVoice:'',speechRate:8,speechPitch:-5,speechVolume:0}
function audioStub(){return {pause(){},load(){},removeAttribute(){this.src=''},async play(){this.onplaying?.()}}}

test('plays the authenticated stream URL without waiting for a complete MP3 blob',async()=>{
 const original=globalThis.fetch, audio=audioStub(), states=[], errors=[], calls=[]
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({id:'ticket-1',url:'/api/jarvis/tts?id=ticket-1'})}
 try{
  const player=new EdgeSpeechPlayback(audio,state=>states.push(state),error=>errors.push(error))
  await player.speak('Halo Jarvis.',options)
  assert.equal(audio.src,'/api/jarvis/tts?id=ticket-1')
  assert.equal(states.at(-1),'speaking')
  assert.equal(JSON.parse(calls[0].init.body).pitch,-5)
  assert.deepEqual(errors,[])
  player.stop()
  assert.equal(calls.at(-1).init.method,'DELETE')
  assert.equal(states.at(-1),'idle')
 }finally{globalThis.fetch=original}
})
test('cancels a pending synthesis and never plays a late ticket',async()=>{
 const original=globalThis.fetch,audio=audioStub();let finish;const released=[]
 globalThis.fetch=async(url,init)=>{
  if(init.method==='DELETE'){released.push(JSON.parse(init.body).id);return Response.json({ok:true})}
  return new Promise(resolve=>{finish=()=>resolve(Response.json({id:'late',url:'/late'}))})
 }
 try{
  const player=new EdgeSpeechPlayback(audio,()=>{},error=>assert.fail(error))
  const pending=player.speak('Balasan lama.',options)
  player.stop();finish();await pending
  assert.equal(audio.src,'')
  assert.deepEqual(released,['late'])
 }finally{globalThis.fetch=original}
})
test('reports server errors and handles browser autoplay rejection',async()=>{
 const original=globalThis.fetch,errors=[],audio=audioStub()
 try{
  globalThis.fetch=async()=>Response.json({error:'Runtime belum tersedia'},{status:503})
  const player=new EdgeSpeechPlayback(audio,()=>{},error=>errors.push(error))
  await player.speak('Halo.',options)
  assert.equal(errors[0],'Runtime belum tersedia')
  globalThis.fetch=async()=>Response.json({id:'blocked',url:'/audio'})
  audio.play=async()=>{throw new DOMException('blocked','NotAllowedError')}
  await player.speak('Halo.',options)
  assert.match(errors[1],/Browser memblokir/)
  player.dispose()
 }finally{globalThis.fetch=original}
})
