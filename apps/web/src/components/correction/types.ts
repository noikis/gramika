import type { useDraft } from '../../hooks/use-draft'
import type { useWritingSession } from '../../hooks/use-writing-session'
import type { useTranslation } from '../../hooks/use-translation'

import type { DictionaryState } from '../../hooks/use-dictionary'
import type { LanguageToolsState } from '../../hooks/use-language-tools'

export type Draft = ReturnType<typeof useDraft>
export type Correction = ReturnType<typeof useWritingSession> & {
  dictionary: DictionaryState
  tools: LanguageToolsState
  translation: ReturnType<typeof useTranslation>
}
export type WorkspaceProps = {
  draft: Draft
  correction: Correction
  onNew: () => void
  isBusy: boolean
}
