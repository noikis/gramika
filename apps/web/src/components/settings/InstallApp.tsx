import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { notify } from '../../lib/notifications'
import '../../styles/install-app.css'
import { useLocale } from '../../i18n/use-locale'

const INSTALL_DISMISSED_KEY = 'gramika.install-dismissed'

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
  } catch {
    // Installation guidance remains usable when browser storage is unavailable.
  }
}

export function InstallApp({
  hasCompletedCorrection,
  isBusy,
}: {
  hasCompletedCorrection: boolean
  isBusy: boolean
}) {
  const { t, message } = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isInstalled, setIsInstalled] = useState(isStandalone)
  const [isHidden, setIsHidden] = useState(isDismissed)
  const [isOpen, setIsOpen] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(navigator.userAgent)
  const isAutoOpen = hasCompletedCorrection && !isHidden && !isBusy && (isIOS || isAndroid)

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    function installed() {
      setIsInstalled(true)
      setIsOpen(false)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', installed)
    const displayMode = window.matchMedia('(display-mode: standalone)')
    function displayChanged() {
      setIsInstalled(isStandalone())
    }
    displayMode.addEventListener('change', displayChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', installed)
      displayMode.removeEventListener('change', displayChanged)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!isInstalled && (isOpen || isAutoOpen)) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [isInstalled, isOpen, isAutoOpen])

  function dismiss() {
    setIsOpen(false)
    setIsHidden(true)
    rememberDismissal()
  }

  async function install() {
    if (!promptEvent || isInstalling) return
    setIsInstalling(true)
    try {
      await promptEvent.prompt()
      dismiss()
    } catch {
      notify(message('installError'))
    } finally {
      setPromptEvent(null)
      setIsInstalling(false)
    }
  }

  if (isInstalled) return null

  return (
    <>
      <Button
        className="install-trigger"
        type="button"
        variant="secondary"
        aria-label={`${t('install')} Грамика`}
        title={`${t('install')} Грамика`}
        onClick={() => setIsOpen(true)}
      >
        <Icon name="install" />
        <span>
          {t('install')}
          <span className="install-name"> Грамика</span>
        </span>
      </Button>
      <dialog
        ref={dialogRef}
        className="install-dialog"
        aria-labelledby="install-title"
        aria-describedby="install-description"
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
      >
        <div className="install-heading">
          <img src="/gramika-brand.png" width="48" height="48" alt="" />
          <Button
            type="button"
            variant="ghost"
            aria-label={t('close')}
            onClick={dismiss}
            disabled={isInstalling}
          >
            <Icon name="close" />
          </Button>
        </div>
        <h2 id="install-title">{t('install')} Грамика</h2>
        <p id="install-description">
          {isIOS
            ? t('installIos')
            : promptEvent
              ? t('installHome')
              : isAndroid
                ? t('installAndroid')
                : t('installBrowser')}
        </p>
        <div className="install-actions">
          <Button type="button" variant="ghost" onClick={dismiss} disabled={isInstalling}>
            {t('notNow')}
          </Button>
          {!isIOS && promptEvent && (
            <Button type="button" onClick={install} disabled={isInstalling}>
              <Icon name="install" />
              {isInstalling ? t('loading') : t('install')}
            </Button>
          )}
        </div>
      </dialog>
    </>
  )
}
