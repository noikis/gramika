import { CorrectionConfig, type PublicConfig } from '@gramota/contracts'

export async function fetchCorrectionConfig(signal: AbortSignal): Promise<PublicConfig> {
  const response = await fetch('/api/correction-config', { signal })
  if (!response.ok) throw Error('Configuration unavailable')
  return CorrectionConfig.parse(await response.json())
}
