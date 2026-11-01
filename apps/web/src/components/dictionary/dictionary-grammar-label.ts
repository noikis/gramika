import { catalogs, Locale } from '../../i18n'

/** Dictionary grammar is always Russian; translated catalogs remain available. */
export function dictionaryGrammarLabel(value: string) {
  const russian = catalogs[Locale.Russian]
  if (Object.hasOwn(russian.dictionaryGrammar, value)) return russian.dictionaryGrammar[value]
  if (Object.hasOwn(russian.dictionaryParts, value)) return russian.dictionaryParts[value]
  // Keep unsupported codes in the response, without leaking English technical tags into the UI.
  return ''
}

export function dictionaryPartHeadingLabel(value: string, locale: Locale) {
  const russian = dictionaryGrammarLabel(value)
  const parts = catalogs[locale].dictionaryParts
  const translation = Object.hasOwn(parts, value) ? parts[value] : ''
  return russian && translation && locale !== Locale.Russian
    ? `${russian} (${translation.toLocaleLowerCase(locale)})`
    : russian
}
