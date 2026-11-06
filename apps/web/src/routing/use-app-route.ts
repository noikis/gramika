import { useCallback, useEffect, useState } from 'react'

export const APP_ROUTES = {
  correction: '/correction',
  history: '/history',
  translation: '/translation',
} as const

export type AppRoute = keyof typeof APP_ROUTES

function routeFromPath(pathname: string): AppRoute {
  if (pathname === APP_ROUTES.history) return 'history'
  if (pathname === APP_ROUTES.translation) return 'translation'
  return 'correction'
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname))

  useEffect(() => {
    function handlePopState() {
      setRoute(routeFromPath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextRoute: AppRoute, replace = false) => {
    const nextPath = APP_ROUTES[nextRoute]
    if (window.location.pathname !== nextPath) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath)
    }
    setRoute(nextRoute)
  }, [])

  return { route, navigate }
}
