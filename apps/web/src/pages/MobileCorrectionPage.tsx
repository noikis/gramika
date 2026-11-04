import { useMemo, useState } from 'react'
import type { ChangeGroup } from '@gramota/text-diff'
import { diffText } from '../lib/text-diff'
import { useLocale } from '../i18n/use-locale'
import type { WorkspaceProps } from '../components/correction/types'
import { OriginalEditor } from '../components/correction/OriginalEditor'
import { MobileResult } from '../components/correction/MobileResult'
import {
  CorrectionSheet,
  type CorrectionSheetPage,
} from '../components/correction/CorrectionSheet'
import { Icon } from '../components/ui/icon'
import { LanguageToolsSidebar } from '../components/translation/LanguageToolsSidebar'

export function MobileCorrectionPage({ draft, correction, onNew, isBusy }: WorkspaceProps) {
  const { t, message } = useLocale()
  const [sheet, setSheet] = useState<CorrectionSheetPage>(null)
  const [selectedGroup, setSelectedGroup] = useState<ChangeGroup | null>(null)
  const [fromCorrections, setFromCorrections] = useState(false)
  const result =
    !correction.draftChanged && correction.visibleVariant?.originalText === draft.text.trim()
      ? correction.visibleVariant
      : null
  const variants = correction.variants
  const activeIndex = variants.findIndex(
    (entry) => entry.result.requestId === result?.requestId,
  )
  const activeEntry = variants[activeIndex]
  const diff = useMemo(
    () => (result ? diffText(result.originalText, result.correctedText) : null),
    [result],
  )
  const groups = diff?.groups ?? []
  const modeName = result?.mode === 'strict' ? t('strictMode') : t('rewriteMode')

  function openExplain(group: ChangeGroup, isFromCorrections = false) {
    setSelectedGroup(group)
    setFromCorrections(isFromCorrections)
    setSheet('explain')
  }

  function closeSheet() {
    setSheet(null)
    setSelectedGroup(null)
    setFromCorrections(false)
  }

  function requestVariant(mode: 'strict' | 'gentle-rewrite') {
    closeSheet()
    void correction.requestVariant(mode)
  }

  return (
    <div className="mobile-correction-workspace">
      <div className="mobile-page-heading">
        <h1>
          <span className="mobile-status-dot" aria-hidden="true" />
          {result ? t('checkCompleted') : t('checkText')}
        </h1>
        {result && (
          <p>{message('correctionsNumber', { count: groups.length })}</p>
        )}
      </div>
      <OriginalEditor
        draft={draft}
        correction={correction}
        onNew={onNew}
        isBusy={isBusy}
        mobile
      />
      {result && activeEntry && (
        <section className="mobile-result-section" aria-label={t('result')}>
          <div className={`mobile-variant-header${variants.length > 1 ? ' has-variants' : ''}`}>
            {variants.length > 1 && (
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() => correction.selectVariant(variants[activeIndex - 1].result.requestId)}
                aria-label={t('previous')}
              >
                <Icon name="chevronLeft" />
              </button>
            )}
            <span className="mobile-variant-divider" aria-hidden="true" />
            <p>
              {message(variants.length > 1 ? 'variantCounter' : 'resultCounter', {
                current: activeIndex + 1,
                total: variants.length,
              })}{' '}
              · {modeName}
            </p>
            <span className="mobile-variant-divider" aria-hidden="true" />
            {variants.length > 1 && (
              <button
                type="button"
                disabled={activeIndex >= variants.length - 1}
                onClick={() => correction.selectVariant(variants[activeIndex + 1].result.requestId)}
                aria-label={t('next')}
              >
                <Icon name="chevronRight" />
              </button>
            )}
          </div>
          <MobileResult
            key={result.requestId}
            result={result}
            view={activeEntry.view}
            onViewChange={(view) => correction.setResultView(result.requestId, view)}
            correction={correction}
            onExplain={(group) => openExplain(group)}
          />
          {groups.length > 0 ? (
            <button
              type="button"
              className="mobile-corrections-trigger"
              onClick={() => setSheet('corrections')}
            >
              <span>{t('correctionsList')} ({groups.length})</span>
              <Icon name="chevronDown" />
            </button>
          ) : (
            <p className="mobile-no-changes">{t('noChanges')}</p>
          )}
          <div className="mobile-result-actions">
            <button
              type="button"
              className="mobile-copy-button"
              onClick={correction.copy}
              disabled={correction.copying}
            >
              <Icon name="copy" />
              {correction.copying ? t('copying') : t('copy')}
            </button>
            <button
              type="button"
              className="mobile-more-variant-button"
              disabled={correction.pending}
              onClick={() => setSheet('variant')}
            >
              <Icon name="plus" />
              {t('moreVariant')}
            </button>
          </div>
          {correction.pending && (
            <p className="mobile-variant-pending" role="status">{t('correcting')}</p>
          )}
        </section>
      )}
      {result && correction.variantError && (
        <div className="mobile-correction-error" role="alert">
          <Icon name="error" /> {correction.variantError}
        </div>
      )}
      <LanguageToolsSidebar
        translation={correction.translation}
        dictionary={correction.dictionary}
        tools={correction.tools}
        onTranslationOpen={() => correction.translation.open('original', draft.text)}
      />
      <CorrectionSheet
        page={sheet}
        onClose={closeSheet}
        onBack={() => setSheet('corrections')}
        canGoBack={fromCorrections}
        onRequestVariant={requestVariant}
        isPending={correction.pending}
        groups={groups}
        requestId={result?.requestId ?? null}
        originalText={result?.originalText ?? ''}
        correctedText={result?.correctedText ?? ''}
        mode={result?.mode ?? 'strict'}
        variantIndex={activeIndex + 1}
        variantTotal={variants.length}
        selectedGroup={selectedGroup}
        onExplain={(group) => openExplain(group, true)}
      />
    </div>
  )
}
