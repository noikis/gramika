import type { ReactNode } from 'react'
import type { CorrectionResult } from '@gramota/contracts'
import type { TranslationScope, TranslationTarget } from '@gramota/contracts'

export type ResultViewMode = 'text' | 'changes'

export type ResultViewResult = Pick<
  CorrectionResult,
  'originalText' | 'correctedText' | 'requestId' | 'mode'
>

export type ResultViewProps = {
  result: ResultViewResult
  view: ResultViewMode
  onViewChange: (view: ResultViewMode) => void
  labelId: string
  title?: string
  compact?: boolean
  actions?: ReactNode
  translation?: {
    target: TranslationTarget
    saved: { scope: string; target: string; translatedText: string } | null
    isOpen: boolean
    pending: boolean
    error: string
    translate: (scope: TranslationScope, text: string, selected?: string) => void
    close: () => void
    clear: () => void
  }
}
