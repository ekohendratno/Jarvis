import test from 'node:test'
import assert from 'node:assert/strict'
import { SpeechPlayback, selectVoice, speechChunks } from '../src/lib/speech-playback.ts'

test('prefers an installed language-matching voice over a remote voice', () => {
  const voices = [{lang:'id-ID',localService:false},{lang:'en-US',localService:true},{lang:'id-ID',localService:true}]
  assert.equal(selectVoice(voices,'id-ID'),voices[2])
  assert.equal(selectVoice(voices,'fr-FR'),undefined)
})
test('splits sentences without splitting time decimals', () => {
  assert.deepEqual(speechChunks('Sekarang pukul 06.40 WIB. Ada tugas baru!'), ['Sekarang pukul 06.40 WIB.', 'Ada tugas baru!'])
})
test('queues only one small utterance, ignores stale events, and stops cleanly', () => {
  const sent=[], states=[]
  const synth={paused:true,getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},resume(){this.paused=false},speak(u){sent.push(u)}}
  const playback=new SpeechPlayback(synth,text=>({text}),s=>states.push(s),error=>assert.fail(error))
  playback.speak('Kalimat pertama. Kalimat kedua.', 'id-ID')
  assert.equal(sent.length,1)
  assert.equal(synth.paused,false)
  assert.equal(states.at(-1),'starting')
  sent[0].onstart(); assert.equal(states.at(-1),'speaking')
  const stale=sent[0]
  playback.speak('Jawaban terbaru.', 'id-ID')
  stale.onend(); stale.onstart()
  assert.equal(sent.length,2)
  assert.equal(states.at(-1),'starting')
  sent[1].onend(); assert.equal(states.at(-1),'idle')
  playback.stop(); playback.dispose()
})
test('plays remaining sentences sequentially', () => {
  const sent=[]
  const synth={paused:false,getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},speak(u){sent.push(u)}}
  const playback=new SpeechPlayback(synth,text=>({text}),()=>{},()=>{})
  playback.speak('Satu. Dua.', 'id-ID')
  sent[0].onend(); assert.equal(sent[1].text,'Dua.')
  playback.dispose(); sent[1].onend(); assert.equal(sent.length,2)
})
