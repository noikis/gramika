import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CorrectionMode } from '@gramota/contracts'
import { clearWorkspace, loadWorkspace, saveWorkspace, type Theme } from '../lib/workspace-storage'
import { notify } from '../lib/notifications'
import { useDraft } from './use-draft'
import { useWritingSession } from './use-writing-session'
import { useLocale } from './use-locale'

export function useWorkspacePersistence() {
  const { message } = useLocale()
  const [restored] = useState(loadWorkspace)
  const draft = useDraft(restored.workspace?.text)
  const correction = useWritingSession(draft.text, draft.revision, restored.workspace)
  const [theme, setTheme] = useState<Theme>(restored.workspace?.theme ?? 'system')
  const serialized = JSON.stringify({
    version: 2,
    text: draft.text,
    theme,
    ...correction.workspace,
    mode: CorrectionMode.enum.strict,
  })
  const lastSaved = useRef(serialized)
  const announcedRestore = useRef(false)

  useLayoutEffect(() => {
    if (lastSaved.current === serialized) return
    lastSaved.current = serialized
    if (!saveWorkspace(serialized)) notify(message('workspaceSaveFailed'))
  }, [message, serialized])

  useEffect(() => {
    if (announcedRestore.current) return
    announcedRestore.current = true
    if (restored.messageKey) notify(message(restored.messageKey))
    else if (
      restored.workspace?.text ||
      restored.workspace?.results.length ||
      restored.workspace?.isRequestPending
    )
      notify(message('workspaceRestored'), true)
  }, [message, restored])

  function clearStoredWorkspace() {
    if (clearWorkspace()) return true
    notify(message('workspaceClearFailed'))
    return false
  }

  return { draft, correction, theme, setTheme, clearStoredWorkspace }
}
