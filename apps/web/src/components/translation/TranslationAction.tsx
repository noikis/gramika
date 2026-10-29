import { useRef } from 'react'
import type { TranslationScope } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'

export function TranslationAction({
  scope,
  getText,
  getSelection,
  translation,
}: {
  scope: TranslationScope
  getText: () => string
  getSelection?: () => string | null
  translation: {
    pending: boolean
    translate: (scope: TranslationScope, text: string, selected?: string) => void
  }
}) {
  const { t } = useLocale()
  const captured = useRef<string | null>(null)
  const text = getText()
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!text.trim() || translation.pending}
      aria-label={t('translate')}
      title={t('translate')}
      onPointerDown={() => {
        captured.current = getSelection?.() ?? null
      }}
      onClick={() => {
        const selection = captured.current ?? getSelection?.() ?? undefined
        captured.current = null
        translation.translate(scope, text, selection)
      }}
    >
      <Icon name="translate" />
    </Button>
  )
}
