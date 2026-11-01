import type { DictionaryGrammar, DictionaryMatch } from '@gramota/contracts'
import { useLocale } from '../../i18n/use-locale'

function grammarLabels(grammar: DictionaryGrammar, labels: Record<string, string>) {
  return Object.entries(grammar)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value : value === true ? [key] : []
      return values.map((tag) => (Object.hasOwn(labels, tag) ? labels[tag] : tag)).join(' / ')
    })
    .filter(Boolean)
    .join(' · ')
}

export function DictionaryWordForm({
  matches,
  query,
  headword,
}: {
  matches: DictionaryMatch[]
  query: string
  headword: string
}) {
  const { t } = useLocale()
  if (!matches.length)
    return headword === query ? null : (
      <p className="dictionary-form" lang="ru">
        {query}
      </p>
    )
  const analyses = matches.map((match, index) => (
    <div className="dictionary-analysis" key={index}>
      {match.form !== headword && <span lang="ru">{match.form}</span>}
      {grammarLabels(match.grammar, t('dictionaryGrammar')) && (
        <span className="dictionary-grammar">
          {grammarLabels(match.grammar, t('dictionaryGrammar'))}
        </span>
      )}
    </div>
  ))
  return matches.length === 1 ? (
    <div className="dictionary-form">{analyses}</div>
  ) : (
    <details className="dictionary-analyses">
      <summary>
        <span>
          {t('dictionaryPossibleForms')} ({matches.length})
        </span>
        <span className="expand-control" aria-hidden="true" />
      </summary>
      <p className="dictionary-grammar">{t('dictionaryAnalysesNote')}</p>
      {analyses}
    </details>
  )
}
