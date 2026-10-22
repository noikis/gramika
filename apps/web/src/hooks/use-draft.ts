import { useRef, useState } from 'react'
import { notify } from '../lib/notifications'

function clipboardErrorMessage(error: unknown) {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'Clipboard access was denied. Paste manually into Original.'
  }
  return 'Could not read the clipboard. Paste manually into Original.'
}

export function useDraft(initialText = '') {
  const [text, setText] = useState(initialText)
  const [pending, setPending] = useState(false)
  const [draftRevision, setDraftRevision] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const revision = useRef(0)
  const reading = useRef(false)

  function edit(value: string) {
    revision.current += 1
    setDraftRevision((current) => current + 1)
    setText(value)
  }

  async function paste() {
    if (reading.current) return
    if (!window.isSecureContext || !navigator.clipboard?.readText) {
      notify('Clipboard unavailable here. Paste manually into Original.')
      return
    }
    const startedAtRevision = revision.current
    reading.current = true
    setPending(true)
    try {
      const value = await navigator.clipboard.readText()
      if (revision.current !== startedAtRevision) {
        notify('Your text changed. Press Paste again to replace it.')
      } else if (value === '') {
        notify('Clipboard is empty. Your text was kept.')
      } else {
        edit(value)
        notify('Pasted', true)
        inputRef.current?.focus()
      }
    } catch (error) {
      notify(clipboardErrorMessage(error))
    } finally {
      reading.current = false
      setPending(false)
    }
  }

  return { text, revision: draftRevision, edit, paste, pending, inputRef }
}
