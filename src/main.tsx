import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invoke, isTauri } from '@tauri-apps/api/core'
import i18n from 'i18n'
import Routes from 'routes'
import 'style/style.css'
import { WindowProvider } from '@pablovsouza/react-window-manager'
import { ThemeProvider, WallpaperProvider } from 'providers'
import { windowRegistry } from 'windows'
import { ApiEndpointBridge } from 'components'
import { Toaster } from 'components/ui'

const rootElement = document.getElementById('root') as HTMLElement | null

const applyRuntimeClasses = (platform?: string) => {
  rootElement?.classList.add('tauri-runtime')
  rootElement?.classList.remove('android-runtime')

  if (!rootElement) {
    return
  }

  rootElement.style.removeProperty('--cu-safe-top')
  rootElement.style.removeProperty('border-radius')
  rootElement.style.removeProperty('clip-path')

  if (platform === 'android') {
    rootElement.classList.add('android-runtime')
    rootElement.style.setProperty('--cu-safe-top', 'max(env(safe-area-inset-top, 0px), 2.25rem)')
    rootElement.style.setProperty('border-radius', '0')
    rootElement.style.setProperty('clip-path', 'none')
  }
}

const detectFallbackPlatform = () => {
  if (/Android/i.test(globalThis.navigator?.userAgent || '')) {
    return 'android'
  }

  return 'unknown'
}

if (isTauri()) {
  applyRuntimeClasses()
  void invoke<string>('get_runtime_platform')
    .then((platform) => {
      applyRuntimeClasses(platform)
    })
    .catch(() => {
      applyRuntimeClasses(detectFallbackPlatform())
    })
} else {
  rootElement?.classList.remove('tauri-runtime')
  rootElement?.classList.remove('android-runtime')
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

ReactDOM.createRoot(rootElement as HTMLElement).render(
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
