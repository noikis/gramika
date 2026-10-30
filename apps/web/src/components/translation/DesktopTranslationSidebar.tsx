import type { RefObject } from 'react'
import { useLocale } from '../../i18n/use-locale'
import { TranslationFields } from './TranslationFields'
import { TranslationHeading } from './TranslationHeading'
import type { TranslationState } from './translation-types'

export function DesktopTranslationSidebar({
  translation,
  sourceRef,
  copying,
  onCopy,
}: {
  translation: TranslationState
  sourceRef: RefObject<HTMLTextAreaElement | null>
  copying: boolean
  onCopy: () => void
}) {
  const { t } = useLocale()
  return (
    <aside
      className={`translation-sidebar desktop-translation-sidebar${translation.isOpen || translation.isClosing ? ' is-open' : ''}${translation.isClosing ? ' is-closing' : ''}`}
      aria-busy={translation.pending}
      aria-label={t('translation')}
      aria-hidden={!translation.isOpen}
    >
      <TranslationHeading translation={translation} />
      <TranslationFields
        translation={translation}
        sourceRef={sourceRef}
        copying={copying}
        onCopy={onCopy}
      />
    </aside>
  )
}
