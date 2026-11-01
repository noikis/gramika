import { useRef } from 'react'
import { RussianWord } from '@gramota/contracts'
import { useLocale } from '../../i18n/use-locale'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { notify } from '../../lib/notifications'

export function DictionaryAction({
  getSelection,
  dictionary,
}: {
  getSelection: () => string | null
  dictionary: Pick<DictionaryState, 'lookup'>
}) {
  const { t } = useLocale()
  const captured = useRef<string | null | undefined>(undefined)
  return (
    <span className="dictionary-action">
      <Button
        type="button"
        variant="ghost"
        aria-label={t('dictionary')}
        title={t('dictionary')}
        onPointerDown={() => {
          captured.current = getSelection()
        }}
        onPointerCancel={() => {
          captured.current = undefined
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') captured.current = getSelection()
        }}
        onClick={() => {
          const selected = captured.current === undefined ? getSelection() : captured.current
          const parsed = RussianWord.safeParse(selected ?? '')
          captured.current = undefined
          if (parsed.success) void dictionary.lookup(parsed.data)
          else notify(t('dictionaryInvalid'))
        }}
      >
        <Icon name="book" />
      </Button>
    </span>
  )
}
