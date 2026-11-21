export type PlaybackState = 'idle' | 'starting' | 'speaking'

export function selectVoice(voices: SpeechSynthesisVoice[], language: string) {
  const normalized = language.toLowerCase()
  const matches = voices.filter(voice => voice.lang.toLowerCase().split('-')[0] === normalized.split('-')[0])
  return [...matches].sort((a, b) => Number(b.localService) - Number(a.localService) || Number(b.lang.toLowerCase() === normalized) - Number(a.lang.toLowerCase() === normalized))[0]
}

export function speechChunks(text: string): string[] {
  const clean = text.replace(/```[\s\S]*?```/g, ' ').replace(/[*#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 4000)
  const words = clean.split(' ')
  const chunks: string[] = []
  let chunk = ''
  for (const word of words) {
    if (!word) continue
    if (chunk && chunk.length + word.length + 1 > 180) { chunks.push(chunk); chunk = '' }
    chunk += (chunk ? ' ' : '') + word
    if (/[.!?]$/.test(word)) { chunks.push(chunk); chunk = '' }
  }
  if (chunk) chunks.push(chunk)
  return chunks
}

export class SpeechPlayback {
  private generation = 0
  private current: SpeechSynthesisUtterance | null = null
  private voices: SpeechSynthesisVoice[] = []
  private refresh = () => { this.voices = this.synth.getVoices() }

  private synth: SpeechSynthesis
  private create: (text: string) => SpeechSynthesisUtterance
  private state: (state: PlaybackState) => void
  private error: (message: string) => void
  constructor(synth: SpeechSynthesis, create: (text: string) => SpeechSynthesisUtterance, state: (state: PlaybackState) => void, error: (message: string) => void) {
    this.synth = synth; this.create = create; this.state = state; this.error = error
    this.refresh()
    synth.addEventListener('voiceschanged', this.refresh)
  }

  prepare() {
    this.refresh()
    if (this.synth.paused) this.synth.resume()
  }

  stop() {
    this.generation++
    this.current = null
    this.synth.cancel()
    this.state('idle')
  }

  speak(text: string, language: string, options?: { browserVoice?: string; speechRate?: number; speechVolume?: number }) {
    this.stop()
    this.prepare()
    const generation = this.generation
    const chunks = speechChunks(text)
    if (!chunks.length) return
    const voice = this.voices.find(voice => options?.browserVoice && voice.voiceURI === options.browserVoice) || selectVoice(this.voices, language)
    this.state('starting')
    const next = () => {
      if (generation !== this.generation) return
      const text = chunks.shift()
      if (!text) { this.current = null; this.state('idle'); return }
      const utterance = this.create(text)
      this.current = utterance
      utterance.lang = language
      utterance.rate = 1 + (options?.speechRate ?? 8) / 100
      utterance.volume = Math.max(0, Math.min(1, 1 + (options?.speechVolume ?? 0) / 100))
      if (voice) utterance.voice = voice
      utterance.onstart = () => { if (generation === this.generation) this.state('speaking') }
      utterance.onend = next
      utterance.onerror = event => {
        if (generation !== this.generation) return
        this.current = null; this.state('idle')
        if (event.error !== 'canceled' && event.error !== 'interrupted') this.error('Suara belum dapat diputar. Tekan mikrofon atau kirim pesan lagi untuk mengaktifkan audio browser.')
      }
      try { this.synth.speak(utterance) } catch { this.current = null; this.state('idle'); this.error('Layanan suara browser belum siap. Coba lagi.') }
    }
    next()
  }

  dispose() {
    this.generation++
    this.current = null
    this.synth.removeEventListener('voiceschanged', this.refresh)
    this.synth.cancel()
  }
}
