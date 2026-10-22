import { MODELS, type CorrectionMode } from '@gramota/contracts'
export { formatCost } from './cost-format'

export function modelName(id: string) {
  return MODELS.find((model) => model.id === id)?.name ?? id
}

export function shortModelName(id: string) {
  return id === MODELS[0].id ? 'Gemma 4' : modelName(id)
}

export function formatDate(value: string | null) {
  return value === null
    ? 'Unavailable'
    : new Date(value).toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
}

export function formatCount(value: number | null) {
  return value === null ? 'Unavailable' : value.toLocaleString('en-US')
}

export function formatTime(value: number | null) {
  return value === null
    ? 'Unavailable'
    : value.toLocaleString('en-US', { maximumSignificantDigits: 12 }) + ' ms'
}

export const modeLabels: Record<CorrectionMode, string> = {
  strict: 'Strict',
  'gentle-rewrite': 'Rewrite',
}
