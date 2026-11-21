'use client'

import { useCallback, useRef, useState } from 'react'

type RealtimeState = 'idle' | 'connecting' | 'listening' | 'speaking'

export default function useRealtimeVoice() {
  const [state, setState] = useState<RealtimeState>('idle')
  const supported = useRef(typeof window !== 'undefined' && 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    setState('connecting')
    // Starter hook: wire your realtime voice provider here.
  }, [])

  const stop = useCallback(() => {
    setState('idle')
  }, [])

  return { state, supported: supported.current, start, stop }
}
