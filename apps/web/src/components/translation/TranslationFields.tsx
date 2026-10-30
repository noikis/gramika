import type { RefObject } from 'react'
import { TranslationSource, TranslationTarget, type TranslationScope } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { Select } from '../ui/select'
import { useLocale } from '../../i18n/use-locale'
import type { TranslationState } from './translation-types'

export function TranslationFields({
  translation,
  sourceRef,
  copying,
  onCopy,
}: {
  translation: TranslationState
  sourceRef: RefObject<HTMLTextAreaElement | null>
  copying: boolean
  onCopy: () => void
}) {
  const { t } = useLocale()
  const languageLabel = (language: TranslationSource | TranslationTarget) =>
    language === 'ru' ? t('russian') : language === 'fr' ? t('french') : t('english')
  const target = translation.saved ? languageLabel(translation.saved.target) : ''

  return (
    <div className="translation-fields">
      {translation.saved && (
        <>
          <label className="translation-target-control">
            <Select
              value={translation.source}
              aria-label={t('translationSource')}
              onChange={(event) => translation.setSource(event.target.value as TranslationSource)}
            >
              <option value={TranslationSource.enum.ru}>{t('russian')}</option>
              <option value={TranslationSource.enum.en}>{t('english')}</option>
              <option value={TranslationSource.enum.fr}>{t('french')}</option>
            </Select>
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
            <Select
              value={translation.target}
              aria-label={t('translationTarget')}
              onChange={(event) => translation.setTarget(event.target.value as TranslationTarget)}
            >
              <option value={TranslationTarget.enum.en}>{t('english')}</option>
              <option value={TranslationTarget.enum.fr}>{t('french')}</option>
              <option value={TranslationTarget.enum.ru}>{t('russian')}</option>
            </Select>
          </label>
          <textarea
            className="translation-text translation-output"
            value={translation.saved.translatedText}
            readOnly
            lang={translation.saved.target}
            aria-label={target}
            placeholder={t('noTranslation')}
          />
          {translation.saved.translatedText && !translation.pending && !translation.error && (
            <Button type="button" variant="secondary" disabled={copying} onClick={onCopy}>
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
    </div>
  )
}
