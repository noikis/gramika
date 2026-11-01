import { useId, useState } from 'react'
import { DictionaryExampleSource, type DictionaryResult } from '@gramota/contracts'
import { useLocale } from '../../i18n/use-locale'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { DictionaryWordForm } from './DictionaryWordForm'
import { DictionaryExampleText } from './DictionaryExampleText'
import { DictionaryEntryDetails } from './DictionaryEntryDetails'

function DictionaryEntry({
  result,
  dictionary,
}: {
  result: DictionaryResult
  dictionary: DictionaryState
}) {
  const { t } = useLocale()
  const labels = t('dictionaryParts')
  const labelFor = (value: string) => (Object.hasOwn(labels, value) ? labels[value] : value)
  const [isPronunciationOpen, setPronunciationOpen] = useState(false)
  const pronunciationId = useId()
  return (
    <section className="dictionary-entry">
      <div className="dictionary-headword">
        <h3 lang="ru">{result.word}</h3>
        <Button
          type="button"
          variant="ghost"
          aria-label={t('dictionaryPronunciation')}
          title={t('dictionaryPronunciation')}
          aria-expanded={isPronunciationOpen}
          aria-controls={pronunciationId}
          onClick={() => {
            setPronunciationOpen(!isPronunciationOpen)
            if (!isPronunciationOpen) void dictionary.loadDetails(result.word)
          }}
        >
          <Icon name="volume" />
        </Button>
      </div>
      <DictionaryWordForm
        matches={result.matches}
        query={dictionary.query}
        headword={result.word}
      />
      <DictionaryEntryDetails
        section="pronunciation"
        word={result.word}
        dictionary={dictionary}
        isPronunciationOpen={isPronunciationOpen}
        onPronunciationToggle={setPronunciationOpen}
        pronunciationId={pronunciationId}
      />
      {result.definitions.map((entry, entryIndex) => {
        const senses = entry.senses.filter((sense) => sense.glosses.some((gloss) => gloss.trim()))
        if (!senses.length) return null
        const label = entry.pos ? labelFor(entry.pos) : null
        return (
          <div className="dictionary-definition" key={entryIndex}>
            {label && <h4>{label}</h4>}
            <ol>
              {senses.map((sense, senseIndex) => (
                <li key={senseIndex}>
                  {sense.tags.filter((tag) => labelFor(tag) !== label).length > 0 && (
                    <p className="dictionary-sense-label">
                      {sense.tags
                        .map(labelFor)
                        .filter((tag) => tag !== label)
                        .join(' · ')}
                    </p>
                  )}
                  {sense.glosses
                    .filter((gloss) => gloss.trim())
                    .map((gloss, glossIndex) => (
                      <p className="dictionary-verbatim" lang="ru" key={glossIndex}>
                        {gloss}
                      </p>
                    ))}
                  {sense.examples.length > 0 && (
                    <details className="dictionary-examples">
                      <summary>
                        <span>
                          {t('dictionaryExamples')} ({sense.examples.length})
                        </span>
                        <span className="expand-control" aria-hidden="true" />
                      </summary>
                      {sense.examples.map((example, exampleIndex) => (
                        <blockquote key={exampleIndex}>
                          <p className="dictionary-verbatim" lang="ru">
                            <DictionaryExampleText example={example} />
                          </p>
                          <footer className="dictionary-source">
                            {t('dictionarySource')}:{' '}
                            {example.source === DictionaryExampleSource.enum.wiktionary
                              ? t('dictionaryWiktionary')
                              : t('dictionaryGenerated')}
                          </footer>
                          {example.citation && (
                            <details className="dictionary-citation">
                              <summary>
                                <span>{t('dictionaryCitation')}</span>
                                <span className="expand-control" aria-hidden="true" />
                              </summary>
                              <p className="dictionary-verbatim" lang="ru">
                                {example.citation}
                              </p>
                            </details>
                          )}
                        </blockquote>
                      ))}
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )
      })}
      <DictionaryEntryDetails
        section="forms"
        word={result.word}
        dictionary={dictionary}
        isPronunciationOpen={isPronunciationOpen}
        onPronunciationToggle={setPronunciationOpen}
        pronunciationId={pronunciationId}
      />
    </section>
  )
}

export function DictionaryPanel({ dictionary }: { dictionary: DictionaryState }) {
  const { t } = useLocale()
  const results =
    dictionary.data?.results.filter((result) =>
      result.definitions.some((entry) =>
        entry.senses.some((sense) => sense.glosses.some((gloss) => gloss.trim())),
      ),
    ) ?? []
  return (
    <div className="dictionary-panel" aria-busy={dictionary.status === 'loading'}>
      {dictionary.query && (dictionary.status !== 'ready' || !results.length) && (
        <p className="dictionary-query">
          {t('dictionarySelected')}: <span lang="ru">{dictionary.query}</span>
        </p>
      )}
      {dictionary.status === 'idle' && <p>{t('dictionaryIdle')}</p>}
      {dictionary.status === 'loading' && <p role="status">{t('dictionaryLoading')}</p>}
      {dictionary.status === 'error' && (
        <div role="alert">
          <p>{t(dictionary.error ?? 'dictionaryFailed')}</p>
          <Button type="button" variant="secondary" onClick={() => void dictionary.retry()}>
            {t('retry')}
          </Button>
        </div>
      )}
      {dictionary.status === 'ready' && !results.length && (
        <p role="status">{t('dictionaryEmpty')}</p>
      )}
      {dictionary.status === 'ready' &&
        results.map((result, index) => (
          <DictionaryEntry key={index} result={result} dictionary={dictionary} />
        ))}
    </div>
  )
}
