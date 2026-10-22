import { useRef, useState } from 'react'
import type { CorrectionResult } from '@gramota/contracts'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'

export function useClipboardCopy(
  result: CorrectionResult | null,
  onCopyFailure: (result: CorrectionResult) => void,
) {
  const [copying, setCopying] = useState(false)
  const writing = useRef(false)

  async function copy() {
    if (!result || writing.current) return
    writing.current = true
    setCopying(true)
    try {
      const outcome = await writeClipboardText(result.correctedText)
      if (!outcome.success) onCopyFailure(result)
      notify(outcome.message, outcome.success)
    } finally {
      writing.current = false
      setCopying(false)
    }
  }

  return { copy, copying, isWriting: () => writing.current }
}
