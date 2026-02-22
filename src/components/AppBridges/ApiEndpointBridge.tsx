import { FC, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isTauri } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { processDeepLinkUrl } from 'services/deepLink'
import { restQueryKeys, setApiBaseUrl } from 'services'

interface ApiEndpointPayload {
  host: string
  port: number
  baseUrl: string
}

const DEEP_LINK_EVENT = 'deep-link://urls'

export const ApiEndpointBridge: FC = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let unlistenDeepLink: (() => void) | undefined
    let unlistenDeepLinkFallback: (() => void) | undefined
    let removeDevDeepLinkListener: (() => void) | undefined
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

            try {
              const result = await processDeepLinkUrl(raw)
              if (!result) continue

              if (result.kind === 'plugin') {
                await queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'list', 'plugins'] })
                toast.success('Plugin added', {
                  description: `${result.name} was installed from deep link.`
                })
                continue
              }

              await Promise.all([
                queryClient.invalidateQueries({ queryKey: restQueryKeys.comics }),
                queryClient.invalidateQueries({ queryKey: ['rest', 'chapters'] })
              ])

              toast.success('New comic added', {
                description: `${result.result.comicName} imported with ${result.result.chaptersImported} chapters${
                  result.result.chaptersSkipped > 0
                    ? ` (${result.result.chaptersSkipped} skipped without pages)`
                    : ''
                }.`
              })
            } catch (error) {
              const message =
                error instanceof Error && error.message.trim().length > 0
                  ? error.message
                  : 'Unknown deep-link import error.'
              console.error('[comic-universe] failed to process deep-link', error)
              toast.error('Import failed', { description: message })
            }
          }
        }

        if (import.meta.env.DEV) {
          const fromQuery = new URLSearchParams(window.location.search).get('deep_link')
          if (fromQuery) {
            void processUrlList([fromQuery])
          }

          ;(window as Window & { __CU_DEBUG_DEEPLINK?: (url: string) => void }).__CU_DEBUG_DEEPLINK =
            (url: string) => {
              if (!url || typeof url !== 'string') return
              void processUrlList([url])
            }

          const devDeepLinkListener = (event: Event) => {
            const detail = (event as CustomEvent<string>).detail
            if (detail && typeof detail === 'string') {
              void processUrlList([detail])
            }
          }
          window.addEventListener('comic-universe:deeplink', devDeepLinkListener)
          removeDevDeepLinkListener = () => {
            window.removeEventListener('comic-universe:deeplink', devDeepLinkListener)
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
        // Browser dev mode: event bridge may not be available.
      }
    }

    void setup()

    return () => {
      cancelled = true
      unlisten?.()
      unlistenDeepLink?.()
      unlistenDeepLinkFallback?.()
      removeDevDeepLinkListener?.()
    }
  }, [queryClient])

  return null
}
