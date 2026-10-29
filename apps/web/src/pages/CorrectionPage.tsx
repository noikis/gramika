import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { Button } from '../components/ui/button'
import { Icon } from '../components/ui/icon'
import { OriginalEditor } from '../components/correction/OriginalEditor'
import { ResultHeading } from '../components/correction/ResultHeading'
import { ResultView } from '../components/results/ResultView'
import type { Correction, WorkspaceProps } from '../components/correction/types'
import { useLocale } from '../i18n/use-locale'
import { LanguageToolsSidebar } from '../components/translation/LanguageToolsSidebar'

function OpinionAction({ correction }: { correction: Correction }) {
  const { t } = useLocale()
  if (
    !correction.results.length ||
    correction.results.some(({ result }) => result.modelId !== DEFAULT_MODEL_ID)
  )
    return null
  return (
    <div className="opinion-action">
      <Button
        type="button"
        variant="secondary"
        disabled={!correction.canRequestOpinion}
        onClick={correction.requestOpinion}
        aria-describedby="opinion-cost"
      >
        <span>
          {correction.isOpinionPending
            ? t('requestingOpinion')
            : correction.opinionError
              ? t('retryOpinion')
              : t('secondOpinion')}
        </span>
        <span id="opinion-cost" className="opinion-button-cost" aria-hidden="true">
          {t('higherCost')}
        </span>
      </Button>
      {correction.isModeChanged ? (
        <p className="clipboard-feedback">
          Correct in {correction.mode === 'strict' ? t('strictMode') : t('rewriteMode')} before
          requesting another opinion.
        </p>
      ) : (
        <>
          {correction.isOpinionPending && <p role="status">{t('gettingOpinion')}</p>}
          {correction.opinionError && (
            <p role="alert">{correction.opinionError} Your Gemma result is still available.</p>
          )}
        </>
      )}
    </div>
  )
}

function MobileRegenerateAction({ correction }: { correction: Correction }) {
  const { t } = useLocale()
  const result = correction.visibleResult
  if (!result || !correction.canRegenerate(result.modelId)) return null
  return (
    <Button
      className="mobile-regenerate-action"
      type="button"
      variant="secondary"
      disabled={false}
      onClick={() => correction.regenerate(result.modelId)}
      aria-label={`Generate ${result.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} again. New paid request`}
    >
      <Icon name="sparkles" />
      {correction.pendingModel === result.modelId ? t('loading') : t('generateAgain')}
    </Button>
  )
}

export function CorrectionPage({ draft, correction, onNew, isBusy }: WorkspaceProps) {
  const { t } = useLocale()
  const activeEntry = correction.visibleResult
    ? correction.results.find(
        ({ result }) => result.requestId === correction.visibleResult?.requestId,
      )
    : undefined
  const activeResult = activeEntry?.result
  return (
    <>
      <div className="workspace-intro">
        <h1 className="sr-only">{t('correction')}</h1>
        <p>{t('writeWithConfidence')}</p>
      </div>
      <div
        className={`translation-stage${correction.translation.isOpen ? ' has-translation' : ''}`}
      >
        {correction.translation.isOpen && (
          <button
            type="button"
            className="translation-backdrop"
            aria-label={t('close')}
            onClick={correction.translation.close}
          />
        )}
        <LanguageToolsSidebar translation={correction.translation} />
        <div className="editors correction-workspace">
          <OriginalEditor draft={draft} correction={correction} onNew={onNew} isBusy={isBusy} />
          <section className="editor result-editor" aria-labelledby="result-title">
            <ResultHeading correction={correction} />
            {activeEntry && activeResult && (
              <div className="workspace-result" key={activeResult.requestId}>
                {activeResult.isCached && (
                  <p className="clipboard-feedback" role="status">
                    {t('savedResult')}
                  </p>
                )}
                <ResultView
                  result={activeResult}
                  view={activeEntry.view}
                  onViewChange={(next) => correction.setResultView(activeResult.requestId, next)}
                  labelId={`result-${activeResult.requestId}`}
                  title={`${activeResult.modelId === DEFAULT_MODEL_ID ? 'Gemma 4' : correction.opinionModelName} · ${activeResult.mode === 'strict' ? t('strictMode') : t('rewriteMode')}`}
                  compact
                  translation={correction.translation}
                  actions={
                    <>
                      <Button
                        type="button"
                        className="workspace-copy-action"
                        variant="secondary"
                        disabled={correction.copying}
                        onClick={correction.copy}
                        aria-label={`Copy ${activeResult.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} result`}
                      >
                        <Icon name="copy" />
                        {correction.copying ? t('copying') : t('copy')}
                      </Button>
                      {correction.canRegenerate(activeResult.modelId) && (
                        <Button
                          type="button"
                          className="regenerate-action desktop-regenerate-action"
                          title="New paid request"
                          variant="secondary"
                          disabled={correction.pendingModel === activeResult.modelId}
                          onClick={() => correction.regenerate(activeResult.modelId)}
                          aria-label={`Generate ${activeResult.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} again. New paid request`}
                        >
                          <Icon name="sparkles" />
                          {correction.pendingModel === activeResult.modelId
                            ? t('loading')
                            : t('generateAgain')}
                        </Button>
                      )}
                    </>
                  }
                />
              </div>
            )}
            {!correction.visibleResult && (
              <div className="result-box">
                <p>
                  {correction.pending
                    ? t('correcting')
                    : correction.draftChanged
                      ? t('originalChanged')
                      : t('noResultYet')}
                </p>
              </div>
            )}
            <p
              id="correction-status"
              className="clipboard-feedback"
              role="status"
              aria-atomic="true"
            >
              {correction.availability ||
                (correction.pending && !correction.isOpinionPending ? t('correcting') : '')}
            </p>
            {correction.error && (
              <p className="clipboard-feedback" role="alert">
                {correction.error}
              </p>
            )}
          </section>
          <div className="workspace-opinion">
            <MobileRegenerateAction correction={correction} />
            <OpinionAction correction={correction} />
          </div>
        </div>
      </div>
      {correction.visibleResult && (
        <>
          {correction.results.length === 2 && correction.opinionError && (
            <p role="alert">
              {correction.opinionError} Your previous Gemini result is still available.
            </p>
          )}
          <div className="mobile-copy-bar">
            <Button type="button" disabled={correction.copying} onClick={correction.copy}>
              <Icon name="copy" /> {correction.copying ? t('copying') : t('copyResult')}
            </Button>
          </div>
        </>
      )}
    </>
  )
}
