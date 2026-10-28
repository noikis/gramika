import { useEffect, useState } from 'react'
import type { PublicConfig } from '@gramota/contracts'
import { fetchCorrectionConfig } from '../api/config'

export function useServiceConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchCorrectionConfig(controller.signal)
      .then((value) => {
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
