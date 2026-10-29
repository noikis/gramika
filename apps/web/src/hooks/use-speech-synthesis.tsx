import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SpeechSynthesisController } from '../lib/browser-speech'
import { SpeechContext } from './speech-context'

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new SpeechSynthesisController())
  const [state, setState] = useState(controller.state)
  useEffect(() => controller.subscribe(setState), [controller])
  const value = useMemo(
    () => ({
      ...state,
      play: (sourceId: string, text: string, lang: string) => controller.play(sourceId, text, lang),
      pause: (sourceId: string) => controller.pause(sourceId),
      resume: (sourceId: string) => controller.resume(sourceId),
      cancel: (sourceId?: string) => controller.cancel(sourceId),
    }),
    [controller, state],
  )
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
}
