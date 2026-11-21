import type { PlaybackState } from './speech-playback'
import type { VoiceOptions } from './voice-options'

export class EdgeSpeechPlayback {
  private audio: HTMLAudioElement
  private state: (state: PlaybackState) => void
  private error: (message: string) => void
  private generation = 0
  private request: AbortController | null = null
  private ticket: string | null = null

  constructor(audio: HTMLAudioElement, state: (state: PlaybackState) => void, error: (message: string) => void) {
    this.audio = audio; this.state = state; this.error = error
    audio.preload = 'auto'
  }
  private releaseTicket(id: string) {
    void fetch('/api/jarvis/tts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {})
  }
  stop(notify = true) {
    this.generation++
    this.request?.abort(); this.request = null
    this.audio.onplaying = null; this.audio.onended = null; this.audio.onerror = null; this.audio.onwaiting = null
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load()
    if (this.ticket) this.releaseTicket(this.ticket)
    this.ticket = null
    if (notify) this.state('idle')
  }
  async speak(text: string, options: VoiceOptions) {
    this.stop()
    const generation = this.generation
    const controller = new AbortController()
    this.request = controller
    this.state('starting')
    const clean = text.replace(/```[\s\S]*?```/g, ' ').replace(/[*#`]/g, '').trim().slice(0, 4000)
    if (!clean) { this.state('idle'); return }
    try {
      const response = await fetch('/api/jarvis/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clean, voice: options.speechVoice, rate: options.speechRate, pitch: options.speechPitch, volume: options.speechVolume }), signal: controller.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Edge TTS belum siap.')
      if (generation !== this.generation) { this.releaseTicket(body.id); return }
      this.ticket = body.id
      this.audio.onplaying = () => { if (generation === this.generation) this.state('speaking') }
      this.audio.onwaiting = () => { if (generation === this.generation) this.state('starting') }
      this.audio.onended = () => {
        if (generation !== this.generation) return
        this.ticket = null; this.state('idle')
      }
      this.audio.onerror = () => {
        if (generation !== this.generation) return
        this.stop(); this.error('Edge TTS gagal memutar audio. Coba preview lagi atau pilih Browser. Pastikan koneksi internet tersedia.')
      }
      this.audio.src = body.url
      await this.audio.play()
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return
      const blocked = error instanceof Error && error.name === 'NotAllowedError'
      this.stop()
      this.error(blocked ? 'Browser memblokir audio otomatis. Tekan Coba suara sekali untuk mengaktifkan audio.' : error instanceof Error ? error.message : 'Edge TTS gagal.')
    }
  }
  dispose() { this.stop(false) }
}
