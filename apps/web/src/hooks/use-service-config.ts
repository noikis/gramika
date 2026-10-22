import { useEffect, useState } from 'react'
import { CorrectionConfig, type PublicConfig } from '@gramota/contracts'

export function useServiceConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/correction-config', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error('Configuration unavailable')
        const value = CorrectionConfig.parse(await response.json())
        if (!controller.signal.aborted) setConfig(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigFailed(true)
      })
    return () => controller.abort()
  }, [attempt])

  function reloadConfig() {
    setConfigFailed(false)
    setAttempt((current) => current + 1)
  }

  const availability = configFailed
    ? 'Could not connect to the correction server.'
    : !config
      ? 'Connecting...'
      : !config.available
        ? 'Only saved results are available. New model requests are not configured.'
        : ''

  return { config, configFailed, reloadConfig, availability }
}
