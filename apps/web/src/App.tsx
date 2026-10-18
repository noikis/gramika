import { useState } from 'react'
import { Button } from './components/ui/button'
import { CorrectionWorkspace } from './components/correction-workspace'
import { useCorrectionDraft } from './use-correction-draft'
import { useCorrection } from './use-correction'
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
    </div>
  )
}

export default App
