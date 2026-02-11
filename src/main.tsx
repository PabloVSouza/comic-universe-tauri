import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from 'i18n'
import Routes from 'routes'
import 'style/style.css'
import { ThemeProvider, WallpaperProvider } from 'providers'

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
        <HashRouter>
          <ThemeProvider>
            <WallpaperProvider>
              <Routes />
            </WallpaperProvider>
          </ThemeProvider>
        </HashRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
