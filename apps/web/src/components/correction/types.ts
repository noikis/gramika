import type { useDraft } from '../../hooks/use-draft'
import type { useWritingSession } from '../../hooks/use-writing-session'

export type Draft = ReturnType<typeof useDraft>
export type Correction = ReturnType<typeof useWritingSession>
export type WorkspaceProps = {
  draft: Draft
  correction: Correction
  onNew: () => void
  isBusy: boolean
}
