import { useEffect, useRef, useState } from 'react'

export type LanguageTool = 'translation' | 'dictionary'
const CLOSE_ANIMATION_MS = 300

export function useLanguageTools(isInitiallyOpen = false) {
  const [isOpen, setOpen] = useState(isInitiallyOpen)
  const [isClosing, setClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<LanguageTool>('translation')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trigger = useRef<HTMLElement | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function open(tab: LanguageTool) {
    if (timer.current) clearTimeout(timer.current)
    if (
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('[data-language-tools]')
    ) {
      trigger.current = document.activeElement
    }
    setActiveTab(tab)
    setClosing(false)
    setOpen(true)
  }

  function close() {
    if (!isOpen && !isClosing) return
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
    setClosing(true)
    timer.current = setTimeout(() => setClosing(false), CLOSE_ANIMATION_MS)
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
  }

  return { isOpen, isClosing, activeTab, setActiveTab, open, close }
}

export type LanguageToolsState = ReturnType<typeof useLanguageTools>
