import { useEffect, useRef, useState } from 'react'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { useLocale } from '../../i18n/use-locale'
import { notify } from '../../lib/notifications'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

export function DictionaryPronunciationButton({
  word,
  dictionary,
}: {
  word: string
  dictionary: DictionaryState
}) {
  const { t } = useLocale()
  const audioRef = useRef<HTMLAudioElement>(null)
  const lifetime = useRef({ isMounted: false })
  const [isLoading, setLoading] = useState(false)
  const details = dictionary.details[word]

  useEffect(() => {
    const audio = audioRef.current
    const mountedLifetime = lifetime.current
    mountedLifetime.isMounted = true
    return () => {
      mountedLifetime.isMounted = false
      if (audio && !audio.paused) audio.pause()
    }
  }, [])

  async function play() {
    setLoading(true)
    try {
      const data =
        details?.status === 'ready'
          ? details.data
          : await dictionary.loadDetails(word, details?.status === 'error')
      const audio = audioRef.current
      if (!lifetime.current.isMounted || !audio || audio.closest('[inert], [aria-hidden="true"]'))
        return
      if (!data) {
        notify(t('dictionaryAudioFailed'))
        return
      }
      const recording = data.entries
        .flatMap((entry) => entry.pronunciations)
        .find((sound) => sound.audioUrl)
      if (!recording?.audioUrl) {
        notify(t('dictionaryNoPronunciation'))
        return
      }
      document
        .querySelectorAll<HTMLAudioElement>('audio[data-dictionary-recording]')
        .forEach((other) => {
          if (other !== audio && !other.paused) other.pause()
        })
      if (audio.getAttribute('src') !== recording.audioUrl) audio.src = recording.audioUrl
      if (audio.error) audio.load()
      audio.currentTime = 0
      await audio.play()
    } catch {
      const audio = audioRef.current
      if (lifetime.current.isMounted && audio && !audio.closest('[inert], [aria-hidden="true"]'))
        notify(t('dictionaryAudioFailed'))
    } finally {
      if (lifetime.current.isMounted) setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={t('dictionaryPronunciation')}
        title={t('dictionaryPronunciation')}
        aria-busy={isLoading}
        disabled={isLoading || details?.status === 'loading'}
        onClick={() => void play()}
      >
        <Icon name="volume" />
      </Button>
      <audio hidden data-dictionary-recording ref={audioRef} preload="none" />
    </>
  )
}
