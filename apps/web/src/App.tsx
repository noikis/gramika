import { useState } from 'react'
import { Toaster } from 'sonner'
import { Button } from './components/ui/button'
import { CorrectionWorkspace } from './components/correction-workspace'
import { useCorrectionDraft } from './hooks/use-correction-draft'
import { useCorrection } from './hooks/use-correction'
import { HistoryPage } from './components/history-page'
import './App.css'

function App() {
  const [view, setView] = useState<'correction' | 'history'>('correction')
  const draft = useCorrectionDraft()
  const correction = useCorrection(draft.text)

  return (
    <div className="shell">
      <header className="app-header">
        <span className="brand">gramota</span>
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
            History
          </Button>
        </nav>
      </header>
      <main>
        {view === 'correction' ? (
          <CorrectionWorkspace draft={draft} correction={correction} />
        ) : (
          <HistoryPage />
        )}
      </main>
      <Toaster
        position="bottom-center"
        theme="dark"
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
