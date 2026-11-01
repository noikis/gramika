import type { ReactNode } from 'react'
import { useLocale } from '../../i18n/use-locale'
import type { LanguageToolsState } from '../../hooks/use-language-tools'

export function DesktopTranslationSidebar({
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
    <aside
      data-language-tools="desktop"
      className={`translation-sidebar desktop-translation-sidebar${tools.isOpen || tools.isClosing ? ' is-open' : ''}${tools.isClosing ? ' is-closing' : ''}`}
      aria-label={t(tools.activeTab)}
      aria-hidden={!tools.isOpen}
      inert={!tools.isOpen}
    >
      {heading}
      {children}
    </aside>
  )
}
