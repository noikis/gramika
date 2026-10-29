import { useEffect, useMemo, useRef } from 'react'
import { Button } from './button'
import { Icon } from './icon'
import { useLocale } from '../../i18n/use-locale'
import { useSpeechSynthesis } from '../../hooks/speech-context'
import { notify } from '../../lib/notifications'

type SpeechButtonProps = {
  sourceId: string
  getText: () => string
  lang: string
  className?: string
}

export function SpeechButton({ sourceId, getText, lang, className }: SpeechButtonProps) {
  const { message } = useLocale()
  const tts = useMemo(
    () => ({
      readAloud: message('ttsReadAloud'),
      pause: message('ttsPause'),
      resume: message('ttsResume'),
      unavailable: message('ttsUnavailable'),
      noText: message('ttsNoText'),
      voiceUnavailable: message('ttsVoiceUnavailable'),
      failed: message('ttsFailed'),
    }),
    [message],
  )
  const speech = useSpeechSynthesis()
  const captured = useRef<string | null>(null)
  const lastActivation = useRef(0)
  const cancelRef = useRef(speech.cancel)
  useEffect(() => {
    cancelRef.current = speech.cancel
  }, [speech.cancel])
  useEffect(() => () => cancelRef.current(sourceId), [sourceId])
  const isOwner = speech.sourceId === sourceId
  const status = isOwner ? speech.status : 'idle'
  const disabled = !getText().trim() || status === 'starting'
  const label = status === 'speaking' ? tts.pause : status === 'paused' ? tts.resume : tts.readAloud
  useEffect(() => {
    if (speech.error && speech.sourceId === sourceId) {
      notify(
        speech.error === 'unavailable'
          ? tts.unavailable
          : speech.error === 'voiceUnavailable'
            ? tts.voiceUnavailable
            : tts.failed,
        false,
      )
    }
  }, [speech.error, speech.sourceId, sourceId, tts])
  function activate() {
    const now = Date.now()
    if (now - lastActivation.current < 300) return
    lastActivation.current = now
    const text = captured.current ?? getText()
    captured.current = null
    if (status === 'speaking') speech.pause(sourceId)
    else if (status === 'paused') speech.resume(sourceId)
    else if (text.trim()) speech.play(sourceId, text, lang)
    else notify(tts.noText, false)
  }
  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={() => {
        captured.current = getText()
      }}
      onClick={activate}
    >
      <Icon name={status === 'speaking' ? 'pause' : status === 'paused' ? 'play' : 'volume'} />
    </Button>
  )
}
