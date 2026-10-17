import { useRef, useState } from 'react'

function clipboardErrorMessage(error: unknown) {
  if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
    return 'Clipboard access was denied. Paste manually into Original.'
  }
  return 'Could not read the clipboard. Paste manually into Original.'
}

export function useCorrectionDraft() {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const revision = useRef(0)
  const reading = useRef(false)

  function edit(value: string) {
    revision.current += 1
    setText(value)
    setFeedback('')
  }

  async function paste() {
    if (reading.current) return
    setFeedback('')
    if (!window.isSecureContext || !navigator.clipboard?.readText) {
      setFeedback('Clipboard unavailable here. Paste manually into Original.')
      return
    }
    const startedAtRevision = revision.current
    reading.current = true
    setPending(true)
    setFeedback('Reading clipboard...')
    try {
      const value = await navigator.clipboard.readText()
      if (revision.current !== startedAtRevision) {
        setFeedback('Your text changed. Press Paste again to replace it.')
      } else if (value === '') {
        setFeedback('Clipboard is empty. Your text was kept.')
      } else {
        edit(value)
        setFeedback('Pasted')
        inputRef.current?.focus()
      }
    } catch (error) {
      setFeedback(clipboardErrorMessage(error))
    } finally {
      reading.current = false
      setPending(false)
    }
  }

  return { text, edit, paste, pending, feedback, inputRef }
}
