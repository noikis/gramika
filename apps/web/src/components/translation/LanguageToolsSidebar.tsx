import { useEffect, useRef, useState } from 'react'
import { TranslationSource, TranslationTarget, type TranslationScope } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import { writeClipboardText } from '../../lib/clipboard'
import { notify } from '../../lib/notifications'

export function LanguageToolsSidebar({
  translation,
}: {
  translation: {
    saved: {
      scope: string
      sourceText: string
      source: TranslationSource
      target: TranslationTarget
      translatedText: string
    } | null
    isOpen: boolean
    pending: boolean
    error: string
    close: () => void
    target: TranslationTarget
    setTarget: (target: TranslationTarget) => void
    source: TranslationSource
    setSource: (source: TranslationSource) => void
    updateSourceText: (text: string) => void
    translate: (scope: TranslationScope, sourceText: string) => void
    isClosing: boolean
  }
}) {
  const { t, message } = useLocale()
  const [copying, setCopying] = useState(false)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const hasSavedTranslation = Boolean(translation.saved)
  useEffect(() => {
    if (translation.isOpen && hasSavedTranslation) sourceRef.current?.focus()
  }, [hasSavedTranslation, translation.isOpen])
  const languageLabel = (language: TranslationSource | TranslationTarget) =>
    language === 'ru' ? t('russian') : language === 'fr' ? t('french') : t('english')
  const target = translation.saved ? languageLabel(translation.saved.target) : ''
  async function copy() {
    const text = translation.saved?.translatedText
    if (!text || copying) return
    setCopying(true)
    try {
      const result = await writeClipboardText(text)
      notify(message(result.messageKey), result.success)
    } finally {
      setCopying(false)
    }
  }
  return (
    <aside
      className={`translation-sidebar${translation.isOpen || translation.isClosing ? ' is-open' : ''}${translation.isClosing ? ' is-closing' : ''}`}
      aria-busy={translation.pending}
      aria-label={t('translation')}
      aria-hidden={!translation.isOpen}
    >
      <div className="translation-heading">
        <h3>{t('translation')}</h3>
        <Button
          type="button"
          variant="ghost"
          onClick={translation.close}
          aria-label={t('close')}
          title={t('close')}
        >
          <Icon name="close" />
        </Button>
      </div>
      {translation.saved && (
        <>
          <label className="translation-target-control">
            <select
              value={translation.source}
              aria-label={t('translationSource')}
              onChange={(event) => translation.setSource(event.target.value as TranslationSource)}
            >
              <option value={TranslationSource.enum.ru}>{t('russian')}</option>
              <option value={TranslationSource.enum.en}>{t('english')}</option>
              <option value={TranslationSource.enum.fr}>{t('french')}</option>
            </select>
          </label>
          <textarea
            ref={sourceRef}
            className="translation-source translation-editable"
            value={translation.saved.sourceText}
            onChange={(event) => translation.updateSourceText(event.target.value)}
            lang={translation.source}
            aria-label={languageLabel(translation.source)}
          />
        </>
      )}
      {translation.pending && <p role="status">{t('translating')}</p>}
      {translation.error && <p role="alert">{translation.error}</p>}
      {translation.saved && (
        <>
          <label className="translation-target-control">
            <select
              value={translation.target}
              aria-label={t('translationTarget')}
              onChange={(event) => translation.setTarget(event.target.value as TranslationTarget)}
            >
              <option value={TranslationTarget.enum.en}>{t('english')}</option>
              <option value={TranslationTarget.enum.fr}>{t('french')}</option>
              <option value={TranslationTarget.enum.ru}>{t('russian')}</option>
            </select>
          </label>
          <textarea
            className="translation-text translation-output"
            value={translation.saved.translatedText}
            readOnly
            lang={translation.saved.target}
            aria-label={target}
            placeholder={t('noTranslation')}
          />
        </>
      )}
      {translation.saved && (
        <>
          {translation.saved.translatedText && !translation.pending && !translation.error && (
            <Button
              type="button"
              variant="secondary"
              disabled={copying}
              onClick={() => void copy()}
            >
              <Icon name="copy" /> {copying ? t('copying') : t('copy')}
            </Button>
          )}
          <Button
            type="button"
            disabled={translation.pending || !translation.saved.sourceText.trim()}
            onClick={() =>
              translation.translate(
                translation.saved!.scope as TranslationScope,
                translation.saved!.sourceText,
              )
            }
          >
            <Icon name="translate" /> {t('translate')}
          </Button>
        </>
      )}
    </aside>
  )
}
