import { useEffect, useRef } from 'react'
import { authClient } from '../../auth-client'
import { useLocale } from '../../i18n/use-locale'
import { Button } from '../ui/button'

export function UserMenu({ email }: { email?: string | null }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const { t } = useLocale()

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (detailsRef.current && event.target instanceof Node && !detailsRef.current.contains(event.target))
        detailsRef.current.open = false
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

  return (
    <details ref={detailsRef} className="user-menu" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        detailsRef.current!.open = false
        detailsRef.current?.querySelector('summary')?.focus()
      }
    }}>
      <Button asChild variant="ghost">
        <summary aria-label={t('account')} title={t('account')}>
          <span className="material-symbols-rounded" aria-hidden="true">person</span>
        </summary>
      </Button>
      <div className="user-menu-panel">
        {email && <p className="user-menu-email">{email}</p>}
        <Button type="button" variant="ghost" onClick={() => void authClient.signOut()}>
          <span className="material-symbols-rounded" aria-hidden="true">logout</span>
          {t('signOut')}
        </Button>
      </div>
    </details>
  )
}
