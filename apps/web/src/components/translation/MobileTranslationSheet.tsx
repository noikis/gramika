import type { RefObject } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useLocale } from '../../i18n/use-locale'
import { TranslationFields } from './TranslationFields'
import { TranslationHeading } from './TranslationHeading'
import type { TranslationState } from './translation-types'

export function MobileTranslationSheet({
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
    <Sheet
      unstyled
      className="translation-sheet-root"
      style={{ zIndex: 31 }}
      isOpen={translation.isOpen}
      onClose={translation.close}
      snapPoints={[0, 1]}
      initialSnap={1}
      dragCloseThreshold={0.45}
      dragVelocityThreshold={500}
      detent="content"
    >
      <Sheet.Container
        className="translation-sheet-container"
        style={{
          bottom: 'calc(65px + env(safe-area-inset-bottom))',
          maxHeight: 'calc(88dvh - 65px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('translation')}
      >
        <Sheet.Header className="translation-sheet-header">
          <Sheet.DragIndicator className="translation-drag-indicator" />
          <TranslationHeading translation={translation} />
        </Sheet.Header>
        <Sheet.Content className="translation-sheet-content" disableDrag>
          <TranslationFields
            translation={translation}
            sourceRef={sourceRef}
            copying={copying}
            onCopy={onCopy}
          />
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop className="translation-sheet-backdrop" onClick={translation.close} />
    </Sheet>
  )
}
