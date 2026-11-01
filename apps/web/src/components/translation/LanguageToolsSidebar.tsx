import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useLocale } from '../../i18n/use-locale'
import { writeClipboardText } from '../../lib/clipboard'
import { notify } from '../../lib/notifications'
import { DesktopTranslationSidebar } from './DesktopTranslationSidebar'
import { MobileTranslationSheet } from './MobileTranslationSheet'
import { TranslationHeading } from './TranslationHeading'
import { TranslationFields } from './TranslationFields'
import { DictionaryPanel } from '../dictionary/DictionaryPanel'
import type { TranslationState } from './translation-types'
import type { DictionaryState } from '../../hooks/use-dictionary'
import type { LanguageToolsState, LanguageTool } from '../../hooks/use-language-tools'
import '../../styles/dictionary.css'

const MOBILE_LAYOUT_QUERY = '(max-width: 720px)'

function subscribeLayout(onChange: () => void) {
  const media = window.matchMedia(MOBILE_LAYOUT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches
}

export function LanguageToolsSidebar({
  translation,
  dictionary,
  tools,
  onTranslationOpen,
}: {
  translation: TranslationState
  dictionary: DictionaryState
  tools: LanguageToolsState
  onTranslationOpen: () => void
}) {
  const { message } = useLocale()
  const [copying, setCopying] = useState(false)
  const desktopSourceRef = useRef<HTMLTextAreaElement>(null)
  const mobileSourceRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const isMobile = useSyncExternalStore(subscribeLayout, isMobileLayout)
  const closeRef = useRef(tools.close)
  function activateTab(tab: LanguageTool) {
    if (tab === 'translation' && !translation.saved) onTranslationOpen()
    else tools.setActiveTab(tab)
  }
  useEffect(() => {
    closeRef.current = tools.close
  })
  useEffect(() => {
    if (!tools.isOpen) {
      document
        .querySelectorAll<HTMLAudioElement>('[data-language-tools] audio')
        .forEach((audio) => {
          if (!audio.paused) audio.pause()
        })
      return
    }
    const focusTab = () => {
      const layout = isMobile ? 'mobile' : 'desktop'
      document
        .getElementById(`${id}-${layout}-${tools.activeTab}-tab`)
        ?.focus({ preventScroll: true })
    }
    const frame = requestAnimationFrame(focusTab)
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab' || !isMobile) return
      const container = document.querySelector('[data-language-tools="mobile"]')
      const focusable = container
        ? Array.from(
            container.querySelectorAll<HTMLElement>(
              'button:not([disabled]):not([tabindex="-1"]), textarea, select, summary, audio[controls], [tabindex="0"]',
            ),
          ).filter((element) => element.getClientRects().length > 0)
        : []
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keyboard)
    }
  }, [id, tools.isOpen, tools.activeTab, isMobile])
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
  function content(layout: 'desktop' | 'mobile') {
    const prefix = `${id}-${layout}`
    return (
      <div
        role="tabpanel"
        id={`${prefix}-${tools.activeTab}-panel`}
        aria-labelledby={`${prefix}-${tools.activeTab}-tab`}
        tabIndex={0}
      >
        {tools.activeTab === 'dictionary' ? (
          <DictionaryPanel dictionary={dictionary} />
        ) : (
          <TranslationFields
            translation={translation}
            sourceRef={layout === 'desktop' ? desktopSourceRef : mobileSourceRef}
            copying={copying}
            onCopy={() => void copy()}
          />
        )}
      </div>
    )
  }
  return isMobile ? (
    <MobileTranslationSheet
      tools={tools}
      heading={
        <TranslationHeading tools={tools} prefix={`${id}-mobile`} onTabChange={activateTab} />
      }
    >
      {content('mobile')}
    </MobileTranslationSheet>
  ) : (
    <DesktopTranslationSidebar
      tools={tools}
      heading={
        <TranslationHeading tools={tools} prefix={`${id}-desktop`} onTabChange={activateTab} />
      }
    >
      {content('desktop')}
    </DesktopTranslationSidebar>
  )
}
