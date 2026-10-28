import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { Button } from '../ui/button'
import { useLocale } from '../../hooks/use-locale'
import type { Correction } from './types'

const MIN_SWIPE_DISTANCE_PX = 48
const MOBILE_LAYOUT_QUERY = '(max-width: 720px)'

export function ResultHeading({ correction }: { correction: Correction }) {
  const { t, message } = useLocale()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const activeIndex = correction.results.findIndex(
    ({ result }) => result.requestId === correction.activeRequestId,
  )
  const hasPrevious = activeIndex > 0
  const hasNext = activeIndex >= 0 && activeIndex < correction.results.length - 1
  const activeLabel = correction.visibleResult
    ? correction.visibleResult.modelId === DEFAULT_MODEL_ID
      ? 'Gemma 4'
      : correction.opinionModelName
    : 'Result'
  const visibleRequestId = correction.visibleResult?.requestId
  const previousRequestId = useRef<string | null>(null)

  useEffect(() => {
    if (!visibleRequestId || previousRequestId.current === visibleRequestId) return
    previousRequestId.current = visibleRequestId
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches || !headingRef.current) return
    const bounds = headingRef.current.getBoundingClientRect()
    if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) return
    headingRef.current.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }, [visibleRequestId])

  function switchResult(isNext: boolean) {
    const target = correction.results[isNext ? activeIndex + 1 : activeIndex - 1]
    if (!target) return
    correction.selectResult(target.result.requestId)
    headingRef.current?.focus({ preventScroll: true })
  }

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button'))
      return
    swipeStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return
    const dx = event.clientX - swipeStart.current.x
    const dy = event.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) > MIN_SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy)) switchResult(dx < 0)
  }

  return (
    <div
      className="result-heading"
      onPointerDown={startSwipe}
      onPointerUp={finishSwipe}
      onPointerCancel={() => {
        swipeStart.current = null
      }}
    >
      {hasPrevious && (
        <Button
          className="previous-model"
          variant="secondary"
          aria-label={t('previous')}
          onClick={() => switchResult(false)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Button>
      )}
      <h2 id="result-title" tabIndex={-1} ref={headingRef} aria-live="polite">
        {activeIndex >= 0
          ? message('resultCounter', { current: activeIndex + 1, total: correction.results.length })
          : t('result')}
        <span className="result-model">{activeLabel}</span>
      </h2>
      {hasNext && (
        <Button
          className="next-model"
          variant="secondary"
          aria-label={t('next')}
          onClick={() => switchResult(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Button>
      )}
    </div>
  )
}
