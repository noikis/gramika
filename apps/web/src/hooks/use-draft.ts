import { useRef, useState } from 'react'
import { notify } from '../lib/notifications'
import { useLocale } from './use-locale'

export function useDraft(initialText = '') {
  const { message } = useLocale()
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
      notify(message('clipboardUnavailable'))
      return
    }
    const startedAtRevision = revision.current
    reading.current = true
    setPending(true)
    try {
      const value = await navigator.clipboard.readText()
      if (revision.current !== startedAtRevision) {
        notify(message('textChanged'))
      } else if (value === '') {
        notify(message('clipboardEmpty'))
      } else {
        edit(value)
        notify(message('pasted'), true)
        inputRef.current?.focus()
      }
    } catch (error) {
      notify(
        message(
          error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)
            ? 'clipboardDenied'
            : 'clipboardReadFailed',
        ),
      )
    } finally {
      reading.current = false
      setPending(false)
    }
  }

  return { text, revision: draftRevision, edit, paste, pending, inputRef }
}
