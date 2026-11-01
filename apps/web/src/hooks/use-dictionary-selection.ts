import { useCallback, useEffect, useRef } from 'react'

/** Remember a selection within one rendered surface while its toolbar gains focus. */
export function useDictionarySelection() {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const value = useRef<string | null>(null)
  const capture = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || selection.isCollapsed) {
      if (!document.activeElement?.closest('.dictionary-action')) value.current = null
      return
    }
    const range = selection.getRangeAt(0)
    if (
      !surfaceRef.current?.contains(range.startContainer) ||
      !surfaceRef.current.contains(range.endContainer)
    ) {
      value.current = null
      return
    }
    const fragment = range.cloneContents()
    // Never turn a selection crossing a diff marker into an invented word.
    value.current = fragment.querySelector(
      '.comparison-whitespace, [aria-hidden="true"], [data-marker]',
    )
      ? null
      : fragment.textContent
  }, [])
  useEffect(() => {
    document.addEventListener('selectionchange', capture)
    return () => document.removeEventListener('selectionchange', capture)
  }, [capture])
  return {
    surfaceRef,
    capture,
    getSelection: () => {
      capture()
      return value.current
    },
  }
}
