import type { ComicImportPayload } from './types'

export const SUPPORTED_DEEP_LINK_PROTOCOLS = new Set(['comic-universe:', 'comic-universe-tauri:'])

export const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

export const normalizePluginTag = (value?: string): string | undefined => {
  if (!value) return undefined
  const next = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return next.length > 0 ? next : undefined
}

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export const buildStableId = (...parts: Array<string | undefined>): string => {
  const normalized = parts
    .map((value) => (typeof value === 'string' ? normalizeToken(value) : ''))
    .filter(Boolean)
    .join(':')
  return normalized || `id:${Date.now()}`
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const asRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.map(asRecord).filter((entry) => Object.keys(entry).length > 0) : []

export const pickString = (value: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const raw = value[key]
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim()
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return String(raw)
    }
  }
  return ''
}

export const pickStringArray = (value: Record<string, unknown>, keys: string[]): string[] => {
  const result: string[] = []
  for (const key of keys) {
    const raw = value[key]
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          result.push(entry.trim())
        }
      }
      if (result.length > 0) return result
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      if (raw.includes(',')) {
        return raw
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      }
      return [raw.trim()]
    }
  }
  return []
}

const inferPageFileName = (url: string, index: number): string => {
  const fallback = `page-${String(index + 1).padStart(3, '0')}.jpg`
  try {
    const parsed = new URL(url)
    const last = parsed.pathname.split('/').pop()
    if (last && last.trim().length > 0) return last
  } catch {
    // Ignore invalid URLs and fallback to deterministic filename.
  }
  return fallback
}

export const normalizeChapterPages = (rawPages: unknown): Array<Record<string, unknown>> => {
  let source: unknown = rawPages
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return []
    }
  }

  if (!Array.isArray(source)) return []

  const pages: Array<Record<string, unknown>> = []
  source.forEach((entry, index) => {
    if (typeof entry === 'string') {
      const url = entry.trim()
      if (!url) return
      pages.push({ url, fileName: inferPageFileName(url, index) })
      return
    }

    const record = asRecord(entry)
    const url = pickString(record, ['url', 'src', 'path', 'data'])
    if (!url) return
    pages.push({
      ...record,
      url,
      fileName: pickString(record, ['fileName', 'name']) || inferPageFileName(url, index)
    })
  })
  return pages
}

const parseImportPayload = (raw: unknown): ComicImportPayload | null => {
  const root = asRecord(raw)
  const candidate = Object.prototype.hasOwnProperty.call(root, 'data')
    ? asRecord(root.data)
    : root
  const comic = asRecord(candidate.comic)
  const chapters = asRecordArray(candidate.chapters)
  if (Object.keys(comic).length === 0 || chapters.length === 0) return null
  return { comic, chapters }
}

export const parseComicImportDeepLink = (raw: string): ComicImportPayload | null => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (!SUPPORTED_DEEP_LINK_PROTOCOLS.has(url.protocol)) return null
  if (url.hostname.toLowerCase() !== 'import') return null

  const routeType = url.pathname.replace(/^\/+/, '').split('/')[0]?.toLowerCase() || ''
  const type = (url.searchParams.get('type') || routeType || 'comic').toLowerCase()
  if (type !== 'comic') return null

  const action = (url.searchParams.get('action') || 'import').toLowerCase()
  if (!['add', 'import'].includes(action)) return null

  const dataParam = url.searchParams.get('data')
  if (!dataParam) return null

  try {
    const parsed = JSON.parse(dataParam)
    return parseImportPayload(parsed)
  } catch {
    return null
  }
}
