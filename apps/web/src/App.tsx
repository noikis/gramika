import { useState } from 'react'
import { Button } from './components/ui/button'
import { CorrectionWorkspace } from './components/correction-workspace'
import { useCorrectionDraft } from './use-correction-draft'
import './App.css'

function App() {
  const [view, setView] = useState<'correction' | 'history'>('correction')
  const draft = useCorrectionDraft()

  return (
    <div className="shell">
      <header className="app-header">
        <span className="brand">gramota</span>
        <nav aria-label="Main navigation">
          <Button type="button" variant="ghost" aria-current={view === 'correction' ? 'page' : undefined} onClick={() => setView('correction')}>
            Correction
          </Button>
          <Button type="button" variant="ghost" aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}>
            History
          </Button>
        </nav>
      </header>
      <main>
        {view === 'correction' ? <CorrectionWorkspace draft={draft} /> : (
          <section aria-labelledby="history-title" className="history-unavailable">
            <h1 id="history-title">History</h1>
            <p>History is not available yet.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
