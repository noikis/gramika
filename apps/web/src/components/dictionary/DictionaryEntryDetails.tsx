import { useState } from 'react'
import { DictionaryCase, DictionaryGender, DictionaryNumber } from '@gramota/contracts'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { useLocale } from '../../i18n/use-locale'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { dictionaryGrammarLabel, dictionaryPartHeadingLabel } from './dictionary-grammar-label'

export function DictionaryEntryDetails({
  word,
  dictionary,
}: {
  word: string
  dictionary: DictionaryState
}) {
  const { t, locale } = useLocale()
  const [number, setNumber] = useState('')
  const [gender, setGender] = useState('')
  const [grammaticalCase, setGrammaticalCase] = useState('')
  const state = dictionary.details[word]
  const entries = state?.data?.entries ?? []
  const formCount = entries.reduce((count, entry) => count + entry.forms.length, 0)
  const filteredEntries = entries.map((entry) => ({
    ...entry,
    forms: entry.forms.filter(
      (form) =>
        (!grammaticalCase || form.tags.includes(grammaticalCase)) &&
        (!number || form.tags.includes(number)) &&
        (!gender || form.tags.includes(gender)),
    ),
  }))
  const isEmpty = filteredEntries.every((entry) => !entry.forms.length)
  const labelFor = dictionaryGrammarLabel
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
    <div className="dictionary-entry-details dictionary-forms-details">
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
        {state?.status === 'ready' && formCount > 0 && (
          <div className="dictionary-form-filters" lang="ru">
            <label className="dictionary-case-filter">
              Падеж
              <Select
                aria-label="Падеж"
                value={grammaticalCase}
                onChange={(event) => setGrammaticalCase(event.target.value)}
              >
                <option value="">Все падежи</option>
                {DictionaryCase.options.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Число
              <Select
                aria-label="Число"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              >
                <option value="">Все числа</option>
                {DictionaryNumber.options.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Род
              <Select
                aria-label="Род"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="">Все роды</option>
                {DictionaryGender.options.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        )}
        {state?.status === 'ready' && formCount > 0 && isEmpty && (
          <p role="status">{t('dictionaryNoMatchingForms')}</p>
        )}
        {state?.status === 'ready' &&
          (formCount ? (
            filteredEntries.map(
              (entry, index) =>
                entry.forms.length > 0 && (
                  <div key={index}>
                    {entry.partOfSpeech && labelFor(entry.partOfSpeech) && (
                      <h4 lang="ru">{dictionaryPartHeadingLabel(entry.partOfSpeech, locale)}</h4>
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
                            <td>
                              <ul className="dictionary-form-grammar" lang="ru">
                                {form.tags
                                  .map(labelFor)
                                  .filter(Boolean)
                                  .map((tag, tagIndex) => (
                                    <li key={tagIndex}>{tag}</li>
                                  ))}
                              </ul>
                            </td>
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
    </div>
  )
}
