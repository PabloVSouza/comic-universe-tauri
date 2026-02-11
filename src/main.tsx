import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from 'i18n'
import { HashRouter } from 'react-router-dom'
import Routes from 'routes'
import { I18nextProvider } from 'react-i18next'
import './style/style.css'

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
          <Routes />
        </HashRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
