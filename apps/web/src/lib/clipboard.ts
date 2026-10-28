export async function writeClipboardText(text: string) {
  type ClipboardMessageKey = 'clipboardWriteUnavailable' | 'clipboardWriteFailed' | 'copied'
  try {
    if (!window.isSecureContext || !navigator.clipboard?.writeText) {
      return { success: false, messageKey: 'clipboardWriteUnavailable' as ClipboardMessageKey }
    }
    await navigator.clipboard.writeText(text)
    return { success: true, messageKey: 'copied' as ClipboardMessageKey }
  } catch {
    return { success: false, messageKey: 'clipboardWriteFailed' as ClipboardMessageKey }
  }
}
