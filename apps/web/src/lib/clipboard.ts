export async function writeClipboardText(text: string) {
  const fallback = 'Select the result and copy it manually.'
  try {
    if (!window.isSecureContext || !navigator.clipboard?.writeText) {
      return { success: false, message: `Clipboard unavailable here. ${fallback}` }
    }
    await navigator.clipboard.writeText(text)
    return { success: true, message: 'Copied' }
  } catch {
    return { success: false, message: `Could not access the clipboard. ${fallback}` }
  }
}
