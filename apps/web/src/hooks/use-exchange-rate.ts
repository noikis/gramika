import { useEffect, useState } from 'react'
import { loadExchangeRate } from '../lib/exchange-rate'

export function useExchangeRate() {
  const [rate, setRate] = useState<number | null>(null)

  useEffect(() => {
    let isActive = true
    void loadExchangeRate().then((value) => {
      if (isActive) setRate(value)
    })
    return () => {
      isActive = false
    }
  }, [])

  return rate
}
