'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SpeechPlayback } from '@/lib/speech-playback'
import { EdgeSpeechPlayback } from '@/lib/edge-playback'
import { DEFAULT_VOICE_OPTIONS, type VoiceOptions } from '@/lib/voice-options'

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[]; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }

export function useJarvisVoice(onTranscript: (text: string) => void, language: string, options?: VoiceOptions) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const playback = useRef<SpeechPlayback | null>(null)
  const edgePlayback = useRef<EdgeSpeechPlayback | null>(null)
  const preferences = useRef(options || DEFAULT_VOICE_OPTIONS)
  preferences.current = options || DEFAULT_VOICE_OPTIONS
  const callback = useRef(onTranscript)
  callback.current = onTranscript

  useEffect(() => {
    const speech = window as SpeechWindow
    setSupported(!!(speech.SpeechRecognition || speech.webkitSpeechRecognition))
    const state = (value: 'idle' | 'starting' | 'speaking') => { setSpeaking(value === 'speaking'); setPreparing(value === 'starting') }
    if (window.speechSynthesis) playback.current = new SpeechPlayback(window.speechSynthesis, text => new SpeechSynthesisUtterance(text), state, setError)
    edgePlayback.current = new EdgeSpeechPlayback(new Audio(), state, setError)
    return () => { recognition.current?.abort(); playback.current?.dispose(); edgePlayback.current?.dispose(); playback.current = null; edgePlayback.current = null }
  }, [])

  const stop = useCallback(() => {
    recognition.current?.abort()
    playback.current?.stop()
    edgePlayback.current?.stop()
    setListening(false); setSpeaking(false); setPreparing(false); setInterim('')
  }, [])

  const start = useCallback(() => {
    const speech = window as SpeechWindow
    const Constructor = speech.SpeechRecognition || speech.webkitSpeechRecognition
    if (!Constructor) { setError('Voice input membutuhkan Chrome atau Edge. Anda tetap dapat mengetik perintah.'); return }
    recognition.current?.abort()
    playback.current?.stop()
    edgePlayback.current?.stop()
    playback.current?.prepare()
    setSpeaking(false); setError(''); setInterim('')
    const instance = new Constructor()
    recognition.current = instance
    instance.lang = language
    instance.continuous = false
    instance.interimResults = true
    instance.onresult = event => {
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) { const text = result[0].transcript.trim(); if (text) callback.current(text) }
        else partial += result[0].transcript
      }
      setInterim(partial)
    }
    instance.onerror = event => {
      if (event.error !== 'aborted') setError(event.error === 'not-allowed' ? 'Akses mikrofon ditolak. Izinkan mikrofon pada pengaturan browser.' : event.error === 'no-speech' ? 'Belum terdengar suara. Tekan mikrofon untuk mencoba lagi.' : `Voice input gagal (${event.error}). Coba lagi atau ketik perintah.`)
      setListening(false)
    }
    instance.onend = () => { if (recognition.current === instance) { setListening(false); setInterim('') } }
    try { instance.start(); setListening(true) } catch { setError('Mikrofon belum siap. Coba lagi.'); setListening(false) }
  }, [language])

  const speak = useCallback((text: string) => {
    recognition.current?.abort()
    setError('')
    const settings = preferences.current
    if (settings.speechProvider === 'edge') { playback.current?.stop(); void edgePlayback.current?.speak(text, settings) }
    else { edgePlayback.current?.stop(); playback.current?.speak(text, language, settings) }
  }, [language])
  const prepare = useCallback(() => playback.current?.prepare(), [])

  return { supported, listening, speaking, preparing, interim, error, start, stop, speak, prepare }
}
