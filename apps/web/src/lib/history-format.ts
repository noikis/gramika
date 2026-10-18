import { MODELS } from '@gramota/contracts'

export function modelName(id: string) {
  return MODELS.find((model) => model.id === id)?.name ?? id
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

export function formatCost(value: number | null) {
  if (value === null) return 'Unavailable'
  return (
    value.toLocaleString('en-US', {
      maximumSignificantDigits: 12,
      notation: value > 0 && value < 0.000001 ? 'scientific' : 'standard',
    }) + ' USD'
  )
}

export function formatTime(value: number | null) {
  return value === null
    ? 'Unavailable'
    : value.toLocaleString('en-US', { maximumSignificantDigits: 12 }) + ' ms'
}
