import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isTauri } from '@tauri-apps/api/core'
import { useEffect } from 'react'
import i18n from 'i18n'
import Routes from 'routes'
import 'style/style.css'
import { WindowProvider } from '@pablovsouza/react-window-manager'
import { ThemeProvider, WallpaperProvider } from 'providers'
import { windowRegistry } from 'windows'
import { setApiBaseUrl } from 'services'

if (isTauri()) {
  document.documentElement.classList.add('tauri-runtime')
} else {
  document.documentElement.classList.remove('tauri-runtime')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

interface ApiEndpointPayload {
  host: string
  port: number
  baseUrl: string
}

const ApiEndpointBridge = () => {
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        unlisten = await listen<ApiEndpointPayload>('api://endpoint', (event) => {
          if (cancelled) return
          setApiBaseUrl(event.payload.baseUrl)
          console.info(
            `[comic-universe] REST API endpoint set to ${event.payload.baseUrl} (${event.payload.host}:${event.payload.port})`
          )
        })
      } catch {
        // Not running in Tauri runtime (e.g. plain browser dev), keep env fallback.
      }
    }

    void setup()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return null
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <ApiEndpointBridge />
          <HashRouter>
            <WallpaperProvider>
              <WindowProvider registry={windowRegistry}>
                <Routes />
              </WindowProvider>
            </WallpaperProvider>
          </HashRouter>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
