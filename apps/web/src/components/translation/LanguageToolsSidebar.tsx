import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n/use-locale'
import { writeClipboardText } from '../../lib/clipboard'
import { notify } from '../../lib/notifications'
import { DesktopTranslationSidebar } from './DesktopTranslationSidebar'
import { MobileTranslationSheet } from './MobileTranslationSheet'
import type { TranslationState } from './translation-types'

export function LanguageToolsSidebar({ translation }: { translation: TranslationState }) {
  const { message } = useLocale()
  const [copying, setCopying] = useState(false)
  const desktopSourceRef = useRef<HTMLTextAreaElement>(null)
  const mobileSourceRef = useRef<HTMLTextAreaElement>(null)
  const hasSavedTranslation = Boolean(translation.saved)

  useEffect(() => {
    if (!translation.isOpen || !hasSavedTranslation) return
    const isMobile = window.matchMedia('(max-width: 720px)').matches
    ;(isMobile ? mobileSourceRef : desktopSourceRef).current?.focus({ preventScroll: true })
  }, [hasSavedTranslation, translation.isOpen])

  async function copy() {
    const text = translation.saved?.translatedText
    if (!text || copying) return
    setCopying(true)
    try {
      const result = await writeClipboardText(text)
      notify(message(result.messageKey), result.success)
    } finally {
      setCopying(false)
    }
  }

  const sharedProps = {
    translation,
    copying,
    onCopy: () => void copy(),
  }

  return (
    <>
      <DesktopTranslationSidebar {...sharedProps} sourceRef={desktopSourceRef} />
      <MobileTranslationSheet {...sharedProps} sourceRef={mobileSourceRef} />
    </>
  )
}
