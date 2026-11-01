import { useEffect, useRef, useState } from 'react'
import type { DictionaryPronunciation } from '@gramota/contracts'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { useLocale } from '../../i18n/use-locale'
import { Button } from '../ui/button'

function PronunciationAudio({ sound }: { sound: DictionaryPronunciation }) {
  const { t } = useLocale()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isFailed, setFailed] = useState(false)
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio && !audio.paused) audio.pause()
    }
  }, [])
  return (
    <div className="dictionary-pronunciation">
      {sound.ipa && (
        <p className="dictionary-ipa" lang="ru">
          {sound.ipa}
        </p>
      )}
      {sound.audioUrl && (
        <audio
          ref={audioRef}
          controls
          preload="none"
          src={sound.audioUrl}
          aria-label={t('dictionaryRecording')}
          onError={() => setFailed(true)}
          onCanPlay={() => setFailed(false)}
        />
      )}
      {isFailed && (
        <p role="alert" className="dictionary-grammar">
          {t('dictionaryAudioFailed')}
        </p>
      )}
    </div>
  )
}

export function DictionaryEntryDetails({
  word,
  dictionary,
  isPronunciationOpen,
  onPronunciationToggle,
  pronunciationId,
  section,
}: {
  word: string
  dictionary: DictionaryState
  isPronunciationOpen: boolean
  onPronunciationToggle: (isOpen: boolean) => void
  pronunciationId: string
  section: 'forms' | 'pronunciation'
}) {
  const { t } = useLocale()
  const state = dictionary.details[word]
  const entries = state?.data?.entries ?? []
  const formCount = entries.reduce((count, entry) => count + entry.forms.length, 0)
  const pronunciationCount = entries.reduce(
    (count, entry) => count + entry.pronunciations.length,
    0,
  )
  const labelFor = (tag: string) =>
    Object.hasOwn(t('dictionaryGrammar'), tag) ? t('dictionaryGrammar')[tag] : tag
  const feedback = (
    <>
      {state?.status === 'loading' && <p role="status">{t('dictionaryDetailsLoading')}</p>}
      {state?.status === 'error' && (
        <div role="alert">
          <p>{t(state.error ?? 'dictionaryFailed')}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void dictionary.loadDetails(word, true)}
          >
            {t('retry')}
          </Button>
        </div>
      )}
    </>
  )
  return (
    <div
      className={`dictionary-entry-details dictionary-${section}-details`}
      hidden={section === 'pronunciation' && !isPronunciationOpen}
    >
      {section === 'forms' ? (
        <details
          onToggle={(event) => {
            if (event.currentTarget.open) void dictionary.loadDetails(word)
          }}
        >
          <summary>
            <span>
              {t('dictionaryForms')}
              {state?.status === 'ready' ? ` (${formCount})` : ''}
            </span>
            <span className="expand-control" aria-hidden="true" />
          </summary>
          {feedback}
          {state?.status === 'ready' &&
            (formCount ? (
              entries.map(
                (entry, index) =>
                  entry.forms.length > 0 && (
                    <div key={index}>
                      {entry.partOfSpeech && (
                        <h4>
                          {Object.hasOwn(t('dictionaryParts'), entry.partOfSpeech)
                            ? t('dictionaryParts')[entry.partOfSpeech]
                            : entry.partOfSpeech}
                        </h4>
                      )}
                      <table className="dictionary-forms">
                        <thead>
                          <tr>
                            <th>{t('dictionaryForm')}</th>
                            <th>{t('dictionaryGrammarLabel')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.forms.map((form, formIndex) => (
                            <tr key={formIndex}>
                              <td lang="ru">{form.form}</td>
                              <td>{form.tags.map(labelFor).join(' · ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
              )
            ) : (
              <p>{t('dictionaryNoForms')}</p>
            ))}
        </details>
      ) : (
        <details
          id={pronunciationId}
          open={isPronunciationOpen}
          onToggle={(event) => {
            onPronunciationToggle(event.currentTarget.open)
            if (event.currentTarget.open) void dictionary.loadDetails(word)
          }}
        >
          <summary>
            <span>{t('dictionaryPronunciation')}</span>
            <span className="expand-control" aria-hidden="true" />
          </summary>
          {feedback}
          {isPronunciationOpen &&
            state?.status === 'ready' &&
            (pronunciationCount ? (
              entries.map((entry, index) => (
                <div key={index}>
                  {entry.pronunciations.map((sound, soundIndex) => (
                    <PronunciationAudio key={soundIndex} sound={sound} />
                  ))}
                </div>
              ))
            ) : (
              <p>{t('dictionaryNoPronunciation')}</p>
            ))}
        </details>
      )}
    </div>
  )
}
