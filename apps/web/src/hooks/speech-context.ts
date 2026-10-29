import { createContext, useContext } from 'react'
import type { SpeechError, SpeechStatus } from '../lib/browser-speech'

export type SpeechContextValue = {
  sourceId: string | null
  status: SpeechStatus
  error: SpeechError | null
  play: (sourceId: string, text: string, lang: string) => void
  pause: (sourceId: string) => void
  resume: (sourceId: string) => void
  cancel: (sourceId?: string) => void
}

export const SpeechContext = createContext<SpeechContextValue | null>(null)

export function useSpeechSynthesis() {
  const value = useContext(SpeechContext)
  if (!value) throw new Error('useSpeechSynthesis must be used within SpeechProvider')
  return value
}
