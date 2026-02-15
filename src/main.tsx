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
import { dbFind, dbUpsert, setApiBaseUrl } from 'services'

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

interface PluginDeepLinkPayload {
  endpoint: string
  metadataEndpoint?: string
  name?: string
  tag?: string
}

interface PluginSourceMetadata {
  id: string
  name: string
  languageCodes?: string[]
  isDefault?: boolean
}

interface PluginMetadataResponse {
  name?: string
  tag?: string
  version?: string
  contentTypes?: string[]
  languageCodes?: string[]
  sources?: PluginSourceMetadata[]
}

const DEEP_LINK_EVENT = 'deep-link://urls'
const SUPPORTED_DEEP_LINK_PROTOCOLS = new Set(['comic-universe:', 'comic-universe-tauri:'])

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const normalizePluginTag = (value?: string): string | undefined => {
  if (!value) return undefined
  const next = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return next.length > 0 ? next : undefined
}

const buildPluginId = (tag: string | undefined, endpoint: string): string => {
  if (tag) return `plugin:${tag}`

  const normalizedEndpoint = endpoint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  return `plugin:${normalizedEndpoint || 'remote'}`
}

const parsePluginInstallDeepLink = (raw: string): PluginDeepLinkPayload | null => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (!SUPPORTED_DEEP_LINK_PROTOCOLS.has(url.protocol)) return null
  if (url.hostname.toLowerCase() !== 'plugin') return null
  if (url.pathname.replace(/^\/+/, '').toLowerCase() !== 'install') return null

  const endpointParam = url.searchParams.get('url')?.trim()
  if (!endpointParam) return null

  const endpoint = normalizeBaseUrl(endpointParam)
  const metadataEndpoint = url.searchParams.get('metadataUrl')?.trim() || undefined

  return {
    endpoint,
    metadataEndpoint: metadataEndpoint ? normalizeBaseUrl(metadataEndpoint) : undefined,
    name: url.searchParams.get('name')?.trim() || undefined,
    tag: normalizePluginTag(url.searchParams.get('tag') || undefined)
  }
}

const fetchPluginMetadata = async (
  endpoint: string,
  metadataEndpoint?: string
): Promise<PluginMetadataResponse | null> => {
  const target = metadataEndpoint || `${endpoint}/metadata`
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return null
    const data = (await response.json()) as PluginMetadataResponse
    return data
  } catch {
    return null
  }
}

const installPluginFromDeepLink = async (payload: PluginDeepLinkPayload): Promise<void> => {
  const endpoint = normalizeBaseUrl(payload.endpoint)
  const metadataEndpoint = payload.metadataEndpoint || `${endpoint}/metadata`
  const metadata = await fetchPluginMetadata(endpoint, metadataEndpoint)

  const tag = normalizePluginTag(metadata?.tag || payload.tag || undefined)
  const name =
    metadata?.name?.trim() ||
    payload.name?.trim() ||
    tag ||
    endpoint.replace(/^https?:\/\//, '')

  const existingByEndpoint = await dbFind<Record<string, unknown>>('plugins', 'endpoint', endpoint, 1)
  const existingByLegacyUrl =
    existingByEndpoint.length > 0 ? [] : await dbFind<Record<string, unknown>>('plugins', 'url', endpoint, 1)
  const pluginId = existingByEndpoint[0]?.id || existingByLegacyUrl[0]?.id || buildPluginId(tag, endpoint)

  await dbUpsert(
    'plugins',
    {
      name,
      tag: tag || null,
      endpoint,
      metadataEndpoint,
      enabled: true,
      version: metadata?.version || null,
      contentTypes: metadata?.contentTypes || ['comic'],
      languageCodes: metadata?.languageCodes || [],
      sources: metadata?.sources || [],
      installedFrom: 'deep-link',
      installedAt: new Date().toISOString()
    },
    pluginId
  )

  console.info(`[comic-universe] plugin installed from deep-link: ${name} (${endpoint})`)
}

const ApiEndpointBridge = () => {
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let unlistenDeepLink: (() => void) | undefined
    let unlistenDeepLinkFallback: (() => void) | undefined
    let cancelled = false
    const handledUrls = new Set<string>()

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

        if (!isTauri()) return

        const processUrlList = async (urls: string[]) => {
          for (const raw of urls) {
            if (cancelled || handledUrls.has(raw)) continue
            handledUrls.add(raw)

            const pluginPayload = parsePluginInstallDeepLink(raw)
            if (!pluginPayload) continue

            try {
              await installPluginFromDeepLink(pluginPayload)
            } catch (error) {
              console.error('[comic-universe] failed to install plugin from deep-link', error)
            }
          }
        }

        const deepLink = await import('@tauri-apps/plugin-deep-link')
        unlistenDeepLink = await deepLink.onOpenUrl((urls) => {
          void processUrlList(urls)
        })
        const current = await deepLink.getCurrent()
        if (current && current.length > 0) {
          void processUrlList(current)
        }

        unlistenDeepLinkFallback = await listen<string[]>(DEEP_LINK_EVENT, (event) => {
          void processUrlList(event.payload || [])
        })
      } catch {
        // Not running in Tauri runtime (e.g. plain browser dev), keep env fallback.
      }
    }

    void setup()

    return () => {
      cancelled = true
      unlisten?.()
      unlistenDeepLink?.()
      unlistenDeepLinkFallback?.()
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
