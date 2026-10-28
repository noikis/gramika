import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCorrectionConfig } from '../api/config'

export function useServiceConfig() {
  const [isReloading, setIsReloading] = useState(false)
  const query = useQuery({
    queryKey: ['correction-config'],
    queryFn: ({ signal }) => fetchCorrectionConfig(signal),
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const config = query.data ?? null
  const configFailed = query.isError && !isReloading

  function reloadConfig() {
    setIsReloading(true)
    void query.refetch().finally(() => setIsReloading(false))
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
