'use client'

import { useEffect, useState } from 'react'
import { Loader2, Square, Volume2 } from 'lucide-react'
import { useJarvisVoice } from '@/hooks/useJarvisVoice'
import { DEFAULT_VOICE_OPTIONS, EDGE_VOICES, type VoiceOptions } from '@/lib/voice-options'

export function VoiceSettings({ value, language, change, stopReply }: { value: VoiceOptions; language: string; change: (value: Partial<VoiceOptions>) => void; stopReply: () => void }) {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([])
  const [edgeReady, setEdgeReady] = useState<boolean | null>(null)
  const [sample, setSample] = useState('Halo, saya Jarvis. Saya siap membantu Anda.')
  const options = { ...DEFAULT_VOICE_OPTIONS, ...value }
  const preview = useJarvisVoice(() => {}, language, options)
  const stopPreview = preview.stop
  useEffect(() => {
    const synth = window.speechSynthesis
    const refresh = () => setBrowserVoices(synth?.getVoices().filter((voice, index, voices) => voices.findIndex(item => item.voiceURI === voice.voiceURI) === index) || [])
    refresh(); synth?.addEventListener('voiceschanged', refresh)
    return () => synth?.removeEventListener('voiceschanged', refresh)
  }, [])
  useEffect(() => { let active = true; fetch('/api/jarvis/tts').then(response => response.json()).then(body => { if (active) setEdgeReady(!!body.available) }).catch(() => { if (active) setEdgeReady(false) }); return () => { active = false } }, [])
  useEffect(() => { stopPreview() }, [options.speechProvider, options.speechVoice, options.browserVoice, options.speechRate, options.speechPitch, options.speechVolume, stopPreview])
  return <div className="voice-settings">
    <div className="voice-presets"><button type="button" className="secondary-button" onClick={() => change({ speechProvider: 'edge', speechVoice: 'id-ID-ArdiNeural', speechRate: 8, speechPitch: -5, speechVolume: 0 })}>Preset Jarvis · Ardi</button><button type="button" className="secondary-button" onClick={() => change({ speechProvider: 'edge', speechVoice: 'id-ID-GadisNeural', speechRate: 0, speechPitch: 0, speechVolume: 0 })}>Natural · Gadis</button></div>
    <div className="settings-form-grid">
      <label>Mesin suara<select value={options.speechProvider} onChange={event => change({ speechProvider: event.target.value as VoiceOptions['speechProvider'] })}><option value="browser">Browser · suara perangkat</option><option value="edge">Edge Neural · online</option></select></label>
      {options.speechProvider === 'edge' ? <label>Karakter suara<select value={options.speechVoice} onChange={event => change({ speechVoice: event.target.value })}>{EDGE_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label> : <label>Suara browser<select value={options.browserVoice} onChange={event => change({ browserVoice: event.target.value })}><option value="">Otomatis · utamakan suara lokal</option>{browserVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? ' · lokal' : ' · online'}</option>)}</select></label>}
    </div>
    <p className="setting-hint">{options.speechProvider === 'edge' ? `Edge Neural mengirim teks balasan ke layanan Microsoft online. Memerlukan internet. ${edgeReady === false ? 'Runtime belum tersedia; lihat setup TTS di JARVIS.md.' : edgeReady ? 'Runtime siap.' : 'Memeriksa runtime…'}` : 'Kecepatan awal bergantung pada voice perangkat. Voice lokal diprioritaskan bila memilih otomatis.'}</p>
    <div className="voice-adjustments">
      <label>Kecepatan: {options.speechRate >= 0 ? '+' : ''}{options.speechRate}%<input type="range" min={-30} max={50} step={1} value={options.speechRate} onChange={event => change({ speechRate: Number(event.target.value) })}/></label>
      {options.speechProvider === 'edge' && <label>Nada: {options.speechPitch >= 0 ? '+' : ''}{options.speechPitch} Hz<input type="range" min={-30} max={30} step={1} value={options.speechPitch} onChange={event => change({ speechPitch: Number(event.target.value) })}/></label>}
      <label>Volume: {100 + options.speechVolume}%<input type="range" min={-50} max={0} step={1} value={options.speechVolume} onChange={event => change({ speechVolume: Number(event.target.value) })}/></label>
    </div>
    <label>Teks percobaan<input value={sample} maxLength={300} onChange={event => setSample(event.target.value)}/></label>
    <div className="voice-preview-actions"><button className="secondary-button" type="button" disabled={!sample.trim() || preview.preparing || preview.speaking} onClick={() => { stopReply(); preview.prepare(); preview.speak(sample) }}>{preview.preparing ? <Loader2 className="spin" size={14}/> : <Volume2 size={14}/>} {preview.preparing ? 'Menyiapkan audio…' : preview.speaking ? 'Memutar contoh…' : 'Coba suara'}</button>{(preview.preparing || preview.speaking) && <button type="button" className="secondary-button" onClick={preview.stop}><Square size={13}/> Hentikan contoh</button>}<span>Preview memakai pilihan saat ini. Simpan untuk balasan Jarvis.</span></div>
    {preview.error && <p className="voice-preview-error" role="alert">{preview.error}</p>}
  </div>
}
