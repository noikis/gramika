export const RATE_CACHE_KEY = 'gramota.usd-rub-rate'
export const RATE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const RATE_TIMEOUT_MS = 5_000
const RATE_URL = 'https://open.er-api.com/v6/latest/USD'

type CachedRate = { rate: number; fetchedAt: number }
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function createExchangeRateLoader({
  fetchRate = globalThis.fetch,
  getStorage = (): StorageAccess => localStorage,
  now = Date.now,
} = {}) {
  let memory: CachedRate | null = null
  let pending: Promise<number | null> | null = null

  function readCache(): CachedRate | null {
    let candidate: unknown = memory
    if (!candidate) {
      try {
        candidate = JSON.parse(getStorage().getItem(RATE_CACHE_KEY) ?? 'null')
      } catch {
        return null
      }
    }
    if (!isRecord(candidate) || !isValidRate(candidate.rate)) return null
    const age = now() - Number(candidate.fetchedAt)
    if (typeof candidate.fetchedAt !== 'number' || !Number.isFinite(age)) return null
    if (age < 0 || age >= RATE_CACHE_MAX_AGE_MS) return null
    return { rate: candidate.rate, fetchedAt: candidate.fetchedAt }
  }

  async function requestRate(): Promise<number | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RATE_TIMEOUT_MS)
    try {
      const response = await fetchRate(RATE_URL, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok) return null
      const data: unknown = await response.json()
      if (!isRecord(data) || data.result !== 'success' || data.base_code !== 'USD') return null
      if (!isRecord(data.rates) || !isValidRate(data.rates.RUB)) return null
      memory = { rate: data.rates.RUB, fetchedAt: now() }
      try {
        getStorage().setItem(RATE_CACHE_KEY, JSON.stringify(memory))
      } catch {
        // A blocked or full browser store must not prevent an in-memory conversion.
      }
      return memory.rate
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return function loadRate(): Promise<number | null> {
    const cached = readCache()
    if (cached) {
      memory = cached
      return Promise.resolve(cached.rate)
    }
    if (!pending) pending = requestRate().finally(() => (pending = null))
    return pending
  }
}

export const loadExchangeRate = createExchangeRateLoader()
