import { useState } from 'react'
import { TranslationTarget, type TranslationScope } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { ReadableTextSurface } from '../ui/ReadableTextSurface'
import { useLocale } from '../../i18n/use-locale'
import { writeClipboardText } from '../../lib/clipboard'
import { notify } from '../../lib/notifications'

export function LanguageToolsSidebar({
  translation,
}: {
  translation: {
    saved: { scope: string; sourceText: string; target: string; translatedText: string } | null
    isOpen: boolean
    pending: boolean
    error: string
    close: () => void
    target: TranslationTarget
    setTarget: (target: TranslationTarget) => void
    translate: (scope: TranslationScope, sourceText: string) => void
    isClosing: boolean
  }
}) {
  const { t, message } = useLocale()
  const [copying, setCopying] = useState(false)
  const target =
    translation.saved?.target === TranslationTarget.enum.fr ? t('french') : t('english')
  const scope =
    translation.saved?.scope === 'result'
      ? t('result')
      : translation.saved?.scope === 'explanation'
        ? t('explanation')
        : t('original')
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
      <p className="translation-source-label">{scope}</p>
      {translation.saved?.sourceText && (
        <ReadableTextSurface className="translation-source" lang="ru" aria-label={scope}>
          {translation.saved.sourceText}
        </ReadableTextSurface>
      )}
      <p className="translation-target-label">{target}</p>
      {translation.pending ? (
        <p role="status">{t('translating')}</p>
      ) : translation.error ? (
        <p role="alert">{translation.error}</p>
      ) : translation.saved?.translatedText ? (
        <ReadableTextSurface
          className="translation-text"
          lang={translation.saved.target}
          aria-label={target}
        >
          {translation.saved.translatedText}
        </ReadableTextSurface>
      ) : (
        <p>{t('noTranslation')}</p>
      )}
      {translation.saved?.translatedText && !translation.pending && !translation.error && (
        <>
          <Button type="button" variant="secondary" disabled={copying} onClick={() => void copy()}>
            <Icon name="copy" /> {copying ? t('copying') : t('copy')}
          </Button>
          <label className="translation-target-control">
            <span>{t('translationTarget')}</span>
            <select
              value={translation.target}
              onChange={(event) => translation.setTarget(event.target.value as TranslationTarget)}
            >
              <option value={TranslationTarget.enum.en}>{t('english')}</option>
              <option value={TranslationTarget.enum.fr}>{t('french')}</option>
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
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
