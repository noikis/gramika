import type { ReactNode } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useLocale } from '../../i18n/use-locale'
import type { LanguageToolsState } from '../../hooks/use-language-tools'

export function MobileTranslationSheet({
  tools,
  heading,
  children,
}: {
  tools: LanguageToolsState
  heading: ReactNode
  children: ReactNode
}) {
  const { t } = useLocale()
  return (
    <Sheet
      unstyled
      className="translation-sheet-root"
      style={{ zIndex: 31 }}
      isOpen={tools.isOpen}
      onClose={tools.close}
      snapPoints={[0, 1]}
      initialSnap={1}
      dragCloseThreshold={0.45}
      dragVelocityThreshold={500}
      detent="content"
    >
      <Sheet.Container
        data-language-tools="mobile"
        className="translation-sheet-container"
        style={{
          bottom: 'calc(65px + env(safe-area-inset-bottom))',
          maxHeight: 'calc(88dvh - 65px)',
        }}
        role="dialog"
        inert={!tools.isOpen}
        aria-hidden={!tools.isOpen}
        aria-modal="true"
        aria-label={t(tools.activeTab)}
      >
        <Sheet.Header className="translation-sheet-header">
          <Sheet.DragIndicator className="translation-drag-indicator" />
          {heading}
        </Sheet.Header>
        <Sheet.Content className="translation-sheet-content" disableDrag>
          {children}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop className="translation-sheet-backdrop" onClick={tools.close} />
    </Sheet>
  )
}
