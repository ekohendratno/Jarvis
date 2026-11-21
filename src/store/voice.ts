import { create } from 'zustand'

type VoiceState = {
  isMuted: boolean
  setMuted: (muted: boolean) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isMuted: false,
  setMuted: (muted) => set({ isMuted: muted }),
}))
