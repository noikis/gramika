import type { TranslationScope } from '@gramota/contracts'

export type TranslationController = {
  pending: boolean
  translate: (scope: TranslationScope, text: string, selected?: string) => void
  saved: { scope: string; target: string; translatedText: string } | null
  isOpen: boolean
  error: string
  close: () => void
}

export function selectedTextWithin(element: HTMLElement | null) {
  if (typeof window === 'undefined') return null
  const selection = window.getSelection()
  if (!element || !selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null
  const value = selection.toString()
  return value.trim() ? value : null
}

