import { createContext } from 'react'
import type { Locale, Messages } from './types'
import type { MessageCatalog } from './messages/types'

export type LocaleContextValue = {
  locale: Locale
  messages: Messages
  messageCatalog: MessageCatalog
  setLocale: (locale: Locale) => void
  resetLocale: () => void
  t: <K extends keyof Messages>(key: K) => Messages[K]
  message: <K extends keyof MessageCatalog>(
    key: K,
    values?: Record<string, string | number>,
  ) => string
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)
