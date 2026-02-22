import { importComicFromDeepLink } from './comicImport'
import { installPluginFromDeepLink, parsePluginInstallDeepLink } from './pluginInstall'
import type { DeepLinkProcessResult } from './types'
import { parseComicImportDeepLink } from './utils'

export const processDeepLinkUrl = async (raw: string): Promise<DeepLinkProcessResult | null> => {
  const pluginPayload = parsePluginInstallDeepLink(raw)
  if (pluginPayload) {
    const result = await installPluginFromDeepLink(pluginPayload)
    return { kind: 'plugin', ...result }
  }

  const comicImportPayload = parseComicImportDeepLink(raw)
  if (comicImportPayload) {
    const result = await importComicFromDeepLink(comicImportPayload)
    return { kind: 'comic', result }
  }

  return null
}
