import { describe, expect, it } from 'vitest'
import { catalogs, Locale } from '../../src/i18n'
import {
  dictionaryGrammarLabel,
  dictionaryPartHeadingLabel,
} from '../../src/components/dictionary/dictionary-grammar-label'

describe('dictionary grammar labels', () => {
  it('adds translations in the current interface language without duplicating Russian', () => {
    expect(dictionaryPartHeadingLabel('adjective', Locale.English)).toBe(
      'Прилагательное (adjective)',
    )
    expect(dictionaryPartHeadingLabel('adj', Locale.English)).toBe('Прилагательное (adjective)')
    expect(dictionaryPartHeadingLabel('noun', Locale.French)).toBe('Существительное (nom)')
    expect(dictionaryPartHeadingLabel('adjective', Locale.French)).toBe('Прилагательное (adjectif)')
    expect(dictionaryPartHeadingLabel('noun', Locale.Russian)).toBe('Существительное')
    expect(dictionaryGrammarLabel('nominative')).toBe('Именительный падеж')
    expect(dictionaryPartHeadingLabel('unknown-tag', Locale.French)).toBe('')
  })
  it('always shows Russian grammar and part-of-speech names', () => {
    for (const [tag, label] of Object.entries(catalogs[Locale.Russian].dictionaryGrammar)) {
      expect(dictionaryGrammarLabel(tag)).toBe(label)
    }
    for (const [tag, label] of Object.entries(catalogs[Locale.Russian].dictionaryParts)) {
      expect(dictionaryGrammarLabel(tag)).toBe(label)
    }
  })
  it('retains translations for future use without displaying untranslated technical codes', () => {
    expect(catalogs.en.dictionaryGrammar.genitive).toBe('Genitive')
    expect(catalogs.fr.dictionaryGrammar.genitive).toBe('Génitif')
    expect(catalogs.en.dictionaryGrammar.singular).toBe('Singular')
    expect(catalogs.fr.dictionaryGrammar.singular).toBe('Singulier')
    expect(dictionaryGrammarLabel('singular')).toBe('Единственное число')
    expect(dictionaryGrammarLabel('noun')).toBe('Существительное')
    expect(dictionaryGrammarLabel('unknown-tag')).toBe('')
  })
})
