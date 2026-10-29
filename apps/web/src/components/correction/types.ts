import type { useDraft } from '../../hooks/use-draft'
import type { useWritingSession } from '../../hooks/use-writing-session'
import type { useTranslation } from '../../hooks/use-translation'

export type Draft = ReturnType<typeof useDraft>
export type Correction = ReturnType<typeof useWritingSession> & {
  translation: ReturnType<typeof useTranslation>
}
export type WorkspaceProps = {
  draft: Draft
  correction: Correction
  onNew: () => void
  isBusy: boolean
}
