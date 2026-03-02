import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isTauri } from '@tauri-apps/api/core'
import i18n from 'i18n'
import Routes from 'routes'
import 'style/style.css'
import { WindowProvider } from '@pablovsouza/react-window-manager'
import { ThemeProvider, WallpaperProvider } from 'providers'
import { windowRegistry } from 'windows'
import { ApiEndpointBridge } from 'components'
import { Toaster } from 'components/ui'

if (isTauri()) {
  document.documentElement.classList.add('tauri-runtime')
  if (/Android/i.test(globalThis.navigator?.userAgent || '')) {
    document.documentElement.classList.add('android-runtime')
  } else {
    document.documentElement.classList.remove('android-runtime')
  }
} else {
  document.documentElement.classList.remove('tauri-runtime')
  document.documentElement.classList.remove('android-runtime')
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
          <Toaster position="top-right" />
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
