import type { LanguageToolsState, LanguageTool } from '../../hooks/use-language-tools'
import { useLocale } from '../../i18n/use-locale'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

const TABS: LanguageTool[] = ['translation', 'dictionary']

export function TranslationHeading({
  tools,
  prefix,
  onTabChange = tools.setActiveTab,
}: {
  tools: LanguageToolsState
  prefix: string
  onTabChange?: (tab: LanguageTool) => void
}) {
  const { t } = useLocale()
  return (
    <div className="translation-heading">
      <div role="tablist" aria-label={t('language')} className="language-tools-tabs">
        {TABS.map((tab, index) => (
          <button
            type="button"
            role="tab"
            key={tab}
            id={`${prefix}-${tab}-tab`}
            aria-controls={`${prefix}-${tab}-panel`}
            aria-selected={tools.activeTab === tab}
            tabIndex={tools.activeTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(event) => {
              let next: LanguageTool | undefined
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
                next = TABS[(index + 1) % TABS.length]
              if (event.key === 'Home') next = TABS[0]
              if (event.key === 'End') next = TABS[TABS.length - 1]
              if (next) {
                event.preventDefault()
                onTabChange(next)
                document.getElementById(`${prefix}-${next}-tab`)?.focus()
              }
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={tools.close}
        aria-label={t('close')}
        title={t('close')}
      >
        <Icon name="close" />
      </Button>
    </div>
  )
}
