import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'

const SERVER_DIRECTORY = resolve(__dirname, '..')
const PROJECT_DIRECTORY = resolve(SERVER_DIRECTORY, '../..')
const DEFAULT_SQLITE_PATH = 'data/gramota.sqlite'
const DEFAULT_DICTIONARY_BASE_URL = 'https://dictionary.noikis.ru'

export type Environment = Record<string, string | undefined>
export type ServerConfig = {
  available: boolean
  apiKey: string
  proxyUrl?: string
  databasePath: string
  libreTranslateUrl?: string
  dictionaryBaseUrl?: string
}

export function readEnvironment(): Environment {
  try {
    loadEnvFile(resolve(PROJECT_DIRECTORY, '.env'))
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      return {}
    }
  }
  return process.env
}

export function parseConfig(env: Environment): ServerConfig {
  const isDevelopment = env.NODE_ENV === 'development'
  const isProduction = env.NODE_ENV === 'production'
  const proxyUrl = isProduction ? parseProxyUrl(env.OPENROUTER_PROXY_URL) : undefined
  const apiKey = env.OPENROUTER_API_KEY?.trim() ?? ''
  const libreTranslateUrl = parseServiceUrl(env.LIBRETRANSLATE_URL)

  return {
    available: Boolean(apiKey) && (isDevelopment || (isProduction && Boolean(proxyUrl))),
    apiKey,
    proxyUrl,
    databasePath: resolve(SERVER_DIRECTORY, env.SQLITE_PATH || DEFAULT_SQLITE_PATH),
    libreTranslateUrl,
    dictionaryBaseUrl: parseServiceUrl(
      env.DICTIONARY_BASE_URL?.trim() || DEFAULT_DICTIONARY_BASE_URL,
    ),
  }
}

function parseServiceUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return value.trim().replace(/\/$/u, '')
  } catch {
    return undefined
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
