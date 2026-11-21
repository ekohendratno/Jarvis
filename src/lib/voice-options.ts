export const EDGE_VOICES = [
  { id: 'id-ID-ArdiNeural', name: 'Ardi · Indonesia · pria' },
  { id: 'id-ID-GadisNeural', name: 'Gadis · Indonesia · wanita' },
  { id: 'en-US-GuyNeural', name: 'Guy · English US · male' },
  { id: 'en-US-JennyNeural', name: 'Jenny · English US · female' },
  { id: 'en-US-AriaNeural', name: 'Aria · English US · female' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher · English US · male' },
  { id: 'en-GB-RyanNeural', name: 'Ryan · English UK · male' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia · English UK · female' },
] as const

export type VoiceOptions = { speechProvider: 'browser' | 'edge'; speechVoice: string; browserVoice: string; speechRate: number; speechPitch: number; speechVolume: number }
export const DEFAULT_VOICE_OPTIONS: VoiceOptions = { speechProvider: 'browser', speechVoice: 'id-ID-ArdiNeural', browserVoice: '', speechRate: 8, speechPitch: 0, speechVolume: 0 }
