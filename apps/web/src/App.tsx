import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Button } from './components/ui/button'
import { CorrectionPage } from './pages/CorrectionPage'
import { useWorkspacePersistence } from './hooks/use-workspace-persistence'
import { HistoryPage } from './pages/HistoryPage'
import { Icon } from './components/ui/icon'
import { AppSettings } from './components/settings/AppSettings'
import { notify } from './lib/notifications'
import { InstallApp } from './components/settings/InstallApp'
import { useLocale } from './i18n/use-locale'
import { clearExplicitLocale } from './i18n'
import { TranslationScope } from '@gramota/contracts'
import './styles/app-shell.css'
import './styles/correction.css'
import './styles/results.css'

function App() {
  const { locale, setLocale, resetLocale, t, message } = useLocale()
  const { draft, correction, theme, setTheme, clearStoredWorkspace } = useWorkspacePersistence()
  const [view, setView] = useState<'correction' | 'history'>('correction')
  const [historyWrites, setHistoryWrites] = useState(0)
  const isBusy =
    correction.pending ||
    correction.copying ||
    correction.translation.pending ||
    draft.pending ||
    historyWrites > 0

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    function updateThemeColor() {
      const isDark = theme === 'dark' || (theme === 'system' && system.matches)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', isDark ? '#161819' : '#f5f3ec')
    }
    updateThemeColor()
    system.addEventListener('change', updateThemeColor)
    return () => system.removeEventListener('change', updateThemeColor)
  }, [theme])

  function newCorrection() {
    if (isBusy || !correction.reset()) return
    correction.translation.clear()
    correction.dictionary.clear()
    correction.tools.close()
    draft.edit('')
    setView('correction')
    requestAnimationFrame(() => {
      draft.inputRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }

  function showCorrection() {
    correction.tools.close()
    setView('correction')
  }

  function showHistory() {
    correction.tools.close()
    setView('history')
  }

  function showTranslation() {
    setView('correction')
    correction.translation.open(TranslationScope.enum.original, draft.text)
  }

  function clearLocalData() {
    if (isBusy) return
    if (!clearStoredWorkspace()) return
    newCorrection()
    correction.resetMode()
    correction.translation.resetTarget()
    setTheme('system')
    clearExplicitLocale()
    resetLocale()
    notify(message('workspaceCleared'), true)
  }

  return (
    <div className="shell">
      <header className="app-header">
        <span className="brand" role="img" aria-label="Грамика" lang="ru">
          <img className="brand-mark" src="/gramika-brand.png" width="48" height="48" alt="" />
          <span className="brand-word" aria-hidden="true">
            рамика
          </span>
        </span>
        <nav aria-label={[t('correction'), t('translation'), t('history')].join(' / ')}>
          <Button
            type="button"
            variant="ghost"
            aria-current={view === 'correction' && !correction.tools.isOpen ? 'page' : undefined}
            onClick={showCorrection}
          >
            <Icon name="correction" /> {t('correction')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-current={correction.translation.isOpen ? 'page' : undefined}
            onClick={showTranslation}
          >
            <Icon name="translate" /> {t('translation')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-current={view === 'history' ? 'page' : undefined}
            onClick={showHistory}
          >
            <Icon name="history" /> {t('history')}
          </Button>
        </nav>
        <div className="header-actions">
          <InstallApp hasCompletedCorrection={correction.hasCompletedCorrection} isBusy={isBusy} />
          <div className="desktop-settings">
            <AppSettings
              theme={theme}
              onThemeChange={setTheme}
              onClear={clearLocalData}
              isBusy={isBusy}
              locale={locale}
              onLocaleChange={setLocale}
              translationTarget={correction.translation.target}
              onTranslationTargetChange={correction.translation.setTarget}
            />
          </div>
        </div>
      </header>
      <main>
        {correction.interrupted && (
          <aside className="local-data-controls" aria-label={t('correction')}>
            <p>A request was running when this workspace was closed. It may have finished.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                correction.dismissInterrupted()
                showHistory()
              }}
            >
              {t('history')}
            </Button>
          </aside>
        )}
        {view === 'correction' ? (
          <CorrectionPage
            draft={draft}
            correction={correction}
            onNew={newCorrection}
            isBusy={isBusy}
          />
        ) : (
          <HistoryPage
            onDeleted={correction.forgetHistoryEntry}
            onCopyingChange={(isCopying) =>
              setHistoryWrites((count) => count + (isCopying ? 1 : -1))
            }
          />
        )}
      </main>
      <nav className="mobile-bottom-nav" aria-label={t('mobileNavigation')}>
        <Button
          type="button"
          variant="ghost"
          aria-current={correction.translation.isOpen ? 'page' : undefined}
          onClick={showTranslation}
        >
          <Icon name="translate" />
          <span>{t('translation')}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-current={view === 'correction' && !correction.tools.isOpen ? 'page' : undefined}
          onClick={showCorrection}
        >
          <Icon name="correction" />
          <span>{t('correction')}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-current={view === 'history' ? 'page' : undefined}
          onClick={showHistory}
        >
          <Icon name="history" />
          <span>{t('history')}</span>
        </Button>
      </nav>
      <Toaster
        position="bottom-center"
        theme={theme}
        className="app-toaster"
        visibleToasts={1}
        toastOptions={{
          style: {
            background: 'var(--surface-raised)',
            color: 'var(--text)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 400,
            padding: 'var(--space-3) var(--space-4)',
          },
        }}
      />
    </div>
  )
}

export default App
