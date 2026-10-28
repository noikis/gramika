import { en } from './en'
import { fr } from './fr'
import { ru } from './ru'
import { enMessages } from './messages/en'
import { frMessages } from './messages/fr'
import { ruMessages } from './messages/ru'
import { LOCALES, Locale, type Messages } from './types'
import type { MessageCatalog } from './messages/types'

export { LOCALES, Locale, type LocaleCode, type Messages } from './types'
export type { MessageCatalog } from './messages/types'
export const LOCALE_STORAGE_KEY = 'gramika.interface-locale'
export const catalogs: Record<Locale, Messages> = {
  [Locale.English]: en,
  [Locale.French]: fr,
  [Locale.Russian]: ru,
}
export const messageCatalogs: Record<Locale, MessageCatalog> = {
  [Locale.English]: enMessages,
  [Locale.French]: frMessages,
  [Locale.Russian]: ruMessages,
}

export function interpolateMessage(template: string, values?: Record<string, string | number>) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/gu, (_, key: string) => String(values[key] ?? `{${key}}`))
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale)
}

export function detectLocale(
  languages: readonly string[] = typeof navigator === 'undefined'
    ? []
    : [...navigator.languages, navigator.language],
): Locale {
  for (const language of languages) {
    const primary = language.toLowerCase().split('-')[0]
    if (isLocale(primary)) return primary
  }
  return Locale.English
}

export function loadExplicitLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export function saveExplicitLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* preference remains in memory */
  }
}

export function clearExplicitLocale() {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY)
  } catch {
    /* storage may be unavailable */
  }
}

export function formatDate(
  value: string | null,
  locale: Locale,
  unavailable = catalogs[locale].unavailable,
) {
  return value === null
    ? unavailable
    : new Date(value).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
}

export function formatCount(
  value: number | null,
  locale: Locale,
  unavailable = catalogs[locale].unavailable,
) {
  return value === null ? unavailable : value.toLocaleString(locale)
}
