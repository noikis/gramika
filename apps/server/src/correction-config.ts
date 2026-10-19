import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'

export type Environment = Record<string, string | undefined>
export type ServerConfig = {
  available: boolean
  apiKey: string
  proxyUrl?: string
  databasePath: string
}

export function readEnvironment(): Environment {
  try {
    loadEnvFile(resolve(__dirname, '../.env'))
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      return {}
    }
  }
  return process.env
}

export function parseConfig(env: Environment): ServerConfig {
  const isDevelopment = env.GRAMOTA_ENV === 'development'
  const isProduction = env.GRAMOTA_ENV === 'production'
  const proxyUrl = isProduction ? parseProxyUrl(env.OPENROUTER_PROXY_URL) : undefined
  const apiKey = env.OPENROUTER_API_KEY?.trim() ?? ''

  return {
    available: Boolean(apiKey) && (isDevelopment || (isProduction && Boolean(proxyUrl))),
    apiKey,
    proxyUrl,
    databasePath: env.SQLITE_PATH
      ? resolve(env.SQLITE_PATH)
      : resolve(__dirname, '../data/gramota.sqlite'),
  }
}

function parseProxyUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

    return value.trim()
  } catch {
    return undefined
  }
}
