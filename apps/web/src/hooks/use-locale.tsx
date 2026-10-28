import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  catalogs,
  detectLocale,
  loadExplicitLocale,
  messageCatalogs,
  interpolateMessage,
  saveExplicitLocale,
  type Locale,
  type Messages,
  type MessageCatalog,
} from '../i18n'
import { LocaleContext } from './locale-context'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadExplicitLocale() ?? detectLocale())
  const setLocale = (next: Locale) => {
    setLocaleState(next)
    saveExplicitLocale(next)
  }
  const resetLocale = () => setLocaleState(detectLocale())
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const value = useMemo(
    () => ({
      locale,
      messages: catalogs[locale],
      messageCatalog: messageCatalogs[locale],
      setLocale,
      resetLocale,
      t: <K extends keyof Messages>(key: K) => catalogs[locale][key],
      message: <K extends keyof MessageCatalog>(key: K, values?: Record<string, string | number>) => interpolateMessage(messageCatalogs[locale][key], values),
    }),
    [locale],
  )
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used within LocaleProvider')
  return value
}
