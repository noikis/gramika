import { useRef, useState } from 'react'
import type { CorrectionResult } from '@gramota/contracts'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'
import { useLocale } from '../i18n/use-locale'

export function useClipboardCopy(
  result: CorrectionResult | null,
  onCopyFailure: (result: CorrectionResult) => void,
) {
  const { message } = useLocale()
  const [copying, setCopying] = useState(false)
  const writing = useRef(false)

  async function copy() {
    if (!result || writing.current) return
    writing.current = true
    setCopying(true)
    try {
      const outcome = await writeClipboardText(result.correctedText)
      if (!outcome.success) onCopyFailure(result)
      notify(message(outcome.messageKey), outcome.success)
    } finally {
      writing.current = false
      setCopying(false)
    }
  }

  return { copy, copying, isWriting: () => writing.current }
}
