import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import type { TranslationState } from './translation-types'

export function TranslationHeading({ translation }: { translation: TranslationState }) {
  const { t } = useLocale()
  return (
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
  )
}
