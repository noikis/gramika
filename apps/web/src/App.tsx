import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Button } from './components/ui/button'
import { CorrectionWorkspace } from './components/correction-workspace'
import { useWorkspacePersistence } from './hooks/use-workspace-persistence'
import { HistoryPage } from './components/history-page'
import { Icon } from './components/ui/icon'
import { AppSettings } from './components/app-settings'
import { notify } from './lib/notifications'
import { InstallApp } from './components/install-app'
import './App.css'

function App() {
  const { draft, correction, theme, setTheme, clearStoredWorkspace } = useWorkspacePersistence()
  const [view, setView] = useState<'correction' | 'history'>('correction')
  const [historyWrites, setHistoryWrites] = useState(0)
  const isBusy = correction.pending || correction.copying || draft.pending || historyWrites > 0

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
    draft.edit('')
    setView('correction')
    requestAnimationFrame(() => {
      draft.inputRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }

  function clearLocalData() {
    if (isBusy) return
    if (!clearStoredWorkspace()) return
    newCorrection()
    correction.resetMode()
    setTheme('system')
    notify('Local workspace and preferences cleared. Server history was kept.', true)
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
        <nav aria-label="Main navigation">
          <Button
            type="button"
            variant="ghost"
            aria-current={view === 'correction' ? 'page' : undefined}
            onClick={() => setView('correction')}
          >
            <Icon name="correction" /> Correction
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-current={view === 'history' ? 'page' : undefined}
            onClick={() => setView('history')}
          >
            <Icon name="history" /> History
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
            />
          </div>
        </div>
      </header>
      <main>
        {correction.interrupted && (
          <aside className="local-data-controls" aria-label="Interrupted request">
            <p>A request was running when this workspace was closed. It may have finished.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                correction.dismissInterrupted()
                setView('history')
              }}
            >
              Check history
            </Button>
          </aside>
        )}
        {view === 'correction' ? (
          <CorrectionWorkspace
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
