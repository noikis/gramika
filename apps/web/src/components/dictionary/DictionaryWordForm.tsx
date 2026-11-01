import type { DictionaryGrammar, DictionaryMatch } from '@gramota/contracts'
import { useLocale } from '../../i18n/use-locale'
import { dictionaryGrammarLabel } from './dictionary-grammar-label'

function grammarLabels(grammar: DictionaryGrammar) {
  return Object.entries(grammar)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value : value === true ? [key] : []
      return values.map(dictionaryGrammarLabel).filter(Boolean).join(' / ')
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
      {grammarLabels(match.grammar) && (
        <span className="dictionary-grammar" lang="ru">
          {grammarLabels(match.grammar)}
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
      {analyses}
    </details>
  )
}
