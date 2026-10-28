import { useEffect, useId, useRef } from 'react'
import { THEMES, type Theme } from '../../lib/workspace-storage'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { LOCALES, type Locale } from '../../i18n'
import { useLocale } from '../../i18n/use-locale'

export function ThemeControl({
  theme,
  onChange,
  className = '',
  name = 'theme',
}: {
  theme: Theme
  onChange: (theme: Theme) => void
  className?: string
  name?: string
}) {
  const { t } = useLocale()
  return (
    <fieldset className={`theme-control ${className}`}>
      <legend className="sr-only">{t('appearance')}</legend>
      {THEMES.map((value) => (
        <label key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => onChange(value)}
          />
          <Icon name={value} />
          {value === 'system'
            ? t('themeSystem')
            : value === 'light'
              ? t('themeLight')
              : t('themeDark')}
        </label>
      ))}
    </fieldset>
  )
}

export function AppSettings({
  theme,
  onThemeChange,
  onClear,
  isBusy,
  locale,
  onLocaleChange,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onClear: () => void
  isBusy: boolean
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const clearDescriptionId = useId()
  const { t } = useLocale()

  useEffect(() => {
    function outside(event: PointerEvent) {
      const details = detailsRef.current
      if (details && event.target instanceof Node && !details.contains(event.target))
        details.open = false
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

  return (
    <details
      ref={detailsRef}
      className="app-settings"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        detailsRef.current!.open = false
        detailsRef.current?.querySelector('summary')?.focus()
      }}
    >
      <Button asChild variant="ghost">
        <summary aria-label={t('settings')} title={t('settings')}>
          <Icon name="settings" />
          <span className="settings-label">{t('settings')}</span>
        </summary>
      </Button>
      <div className="settings-panel">
        <p>{t('appearance')}</p>
        <ThemeControl theme={theme} onChange={onThemeChange} name={`theme-${clearDescriptionId}`} />
        <label>
          {t('language')}
          <select
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
            disabled={isBusy}
          >
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {value === 'en' ? 'English' : value === 'fr' ? 'Français' : 'Русский'}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          disabled={isBusy}
          aria-describedby={clearDescriptionId}
          onClick={() => {
            onClear()
            if (detailsRef.current) detailsRef.current.open = false
            detailsRef.current?.querySelector('summary')?.focus()
          }}
        >
          <Icon name="reset" /> {t('clearLocalData')}
        </Button>
        <p id={clearDescriptionId} className="sr-only">
          {t('clearDescription')}
        </p>
      </div>
    </details>
  )
}
