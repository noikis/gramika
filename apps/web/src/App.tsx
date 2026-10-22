import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Button } from './components/ui/button'
import { CorrectionWorkspace } from './components/correction-workspace'
import { useCorrectionDraft } from './hooks/use-correction-draft'
import { useCorrection } from './hooks/use-correction'
import { HistoryPage } from './components/history-page'
import { Icon } from './components/ui/icon'
import './App.css'

function App() {
  const [view, setView] = useState<'correction' | 'history'>('correction')
  const draft = useCorrectionDraft()
  const correction = useCorrection(draft.text, draft.revision)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [historyWrites, setHistoryWrites] = useState(0)
  const isBusy = correction.pending || correction.copying || draft.pending || historyWrites > 0

  useEffect(() => {
    document.documentElement.dataset.theme = theme
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

  return (
    <div className="shell">
      <header className="app-header">
        <span className="brand">
          <span className="brand-mark">Г</span> Gramota
        </span>
        <nav aria-label="Main navigation">
          <Button
            type="button"
            variant="ghost"
            aria-current={view === 'correction' ? 'page' : undefined}
            onClick={() => setView('correction')}
          >
            Correction
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
        <fieldset className="theme-control">
          <legend className="sr-only">Theme preference</legend>
          {(['system', 'light', 'dark'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
              />
              <Icon name={value} />
              {value[0].toUpperCase() + value.slice(1)}
            </label>
          ))}
        </fieldset>
        <Button
          className="new-correction"
          variant="ghost"
          onClick={newCorrection}
          disabled={isBusy}
        >
          <Icon name="plus" /> <span>New correction</span>
        </Button>
      </header>
      <main>
        {view === 'correction' ? (
          <CorrectionWorkspace draft={draft} correction={correction} />
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
