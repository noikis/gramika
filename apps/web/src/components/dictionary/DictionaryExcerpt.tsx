import type { ReactNode } from 'react'
import type { DictionaryState } from '../../hooks/use-dictionary'
import { useDictionarySelection } from '../../hooks/use-dictionary-selection'
import { DictionaryAction } from './DictionaryAction'

export function DictionaryExcerpt({
  children,
  dictionary,
}: {
  children: ReactNode
  dictionary?: DictionaryState
}) {
  const { surfaceRef, capture, getSelection } = useDictionarySelection()
  return (
    <>
      <div
        ref={surfaceRef}
        onPointerUp={capture}
        onKeyUp={capture}
        tabIndex={dictionary ? 0 : undefined}
      >
        {children}
      </div>
      {dictionary && <DictionaryAction dictionary={dictionary} getSelection={getSelection} />}
    </>
  )
}
