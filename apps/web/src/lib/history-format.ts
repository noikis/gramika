import { MODELS, type CorrectionMode } from '@gramota/contracts'
import { Locale, type Locale as LocaleCode } from '../i18n'
export { formatCost } from './cost-format'

export function modelName(id: string) {
  return MODELS.find((model) => model.id === id)?.name ?? id
}

export function shortModelName(id: string) {
  return id === MODELS[0].id ? 'Gemma 4' : modelName(id)
}

export function formatDate(value: string | null, locale: LocaleCode = Locale.English) {
  return value === null
    ? 'Unavailable'
    : new Date(value).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
}

export function formatCount(value: number | null, locale: LocaleCode = Locale.English) {
  return value === null ? 'Unavailable' : value.toLocaleString(locale)
}

export function formatTime(value: number | null) {
  if (value === null) return 'Unavailable'
  const MILLISECONDS_PER_SECOND = 1000
  return value < MILLISECONDS_PER_SECOND
    ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ms'
    : (value / MILLISECONDS_PER_SECOND).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' s'
}

export const modeLabels: Record<CorrectionMode, string> = {
  strict: 'Strict',
  'gentle-rewrite': 'Rewrite',
}
