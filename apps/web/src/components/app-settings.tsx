import { useEffect, useId, useRef } from 'react'
import { THEMES, type Theme } from '../lib/workspace-storage'
import { Button } from './ui/button'
import { Icon } from './ui/icon'

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
  return (
    <fieldset className={`theme-control ${className}`}>
      <legend className="sr-only">Theme preference</legend>
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
          {value[0].toUpperCase() + value.slice(1)}
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
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onClear: () => void
  isBusy: boolean
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const clearDescriptionId = useId()

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
        <summary aria-label="Settings" title="Settings">
          <Icon name="settings" />
          <span className="settings-label">Settings</span>
        </summary>
      </Button>
      <div className="settings-panel">
        <p>Appearance</p>
        <ThemeControl theme={theme} onChange={onThemeChange} name={`theme-${clearDescriptionId}`} />
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
          <Icon name="reset" /> Clear local data
        </Button>
        <p id={clearDescriptionId} className="sr-only">
          Clear this device’s workspace and preferences. Server history is kept.
        </p>
      </div>
    </details>
  )
}
