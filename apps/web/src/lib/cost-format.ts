const KOPECKS_PER_RUBLE = 100
const SCIENTIFIC_THRESHOLD = 0.000001
const SIGNIFICANT_DIGITS = 3
const kopeckUnits: Record<Intl.LDMLPluralRule, string> = {
  zero: 'копеек',
  one: 'копейка',
  two: 'копейки',
  few: 'копейки',
  other: 'копейки',
  many: 'копеек',
}
const pluralRules = new Intl.PluralRules('ru', { maximumSignificantDigits: SIGNIFICANT_DIGITS })

export function formatCost(value: number | null, rubPerUsd: number | null = null) {
  if (value === null) return 'Unavailable'
  const kopecks = rubPerUsd === null ? NaN : value * rubPerUsd * KOPECKS_PER_RUBLE
  if (
    rubPerUsd !== null &&
    Number.isFinite(rubPerUsd) &&
    rubPerUsd > 0 &&
    Number.isFinite(kopecks) &&
    (value === 0 || kopecks > 0)
  ) {
    const isScientific = kopecks > 0 && kopecks < SCIENTIFIC_THRESHOLD
    const number = kopecks.toLocaleString('ru-RU', {
      maximumSignificantDigits: SIGNIFICANT_DIGITS,
      notation: isScientific ? 'scientific' : 'standard',
    })
    const unit = isScientific ? 'копейки' : kopeckUnits[pluralRules.select(kopecks)]
    return `${number} ${unit}`
  }
  return (
    value.toLocaleString('en-US', {
      maximumSignificantDigits: 12,
      notation: value > 0 && value < SCIENTIFIC_THRESHOLD ? 'scientific' : 'standard',
    }) + ' USD'
  )
}
