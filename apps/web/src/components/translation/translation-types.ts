import type { TranslationScope, TranslationSource, TranslationTarget } from '@gramota/contracts'

export type TranslationState = {
  saved: {
    scope: string
    sourceText: string
    source: TranslationSource
    target: TranslationTarget
    translatedText: string
  } | null
  isOpen: boolean
  pending: boolean
  error: string
  close: () => void
  target: TranslationTarget
  setTarget: (target: TranslationTarget) => void
  source: TranslationSource
  setSource: (source: TranslationSource) => void
  updateSourceText: (text: string) => void
  translate: (scope: TranslationScope, sourceText: string) => void
  isClosing: boolean
}
