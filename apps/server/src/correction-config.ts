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
  const development = env.GRAMOTA_ENV === 'development'
  const homelab = env.GRAMOTA_ENV === 'homelab'
  const proxyUrl = homelab ? env.OPENROUTER_PROXY_URL : undefined
  const apiKey = env.OPENROUTER_API_KEY?.trim() ?? ''
  return {
    available:
      Boolean(apiKey) && (development || (homelab && proxyUrl === 'http://10.201.0.2:8888')),
    apiKey,
    proxyUrl,
    databasePath: env.SQLITE_PATH
      ? resolve(env.SQLITE_PATH)
      : resolve(__dirname, '../data/gramota.sqlite'),
  }
}
