import { dbUpsert, type DbRecord } from 'services'

export interface PluginRecordData {
  endpoint?: string
  url?: string
  enabled?: boolean
  name?: string
  tag?: string
  contentTypes?: string[]
  languageCodes?: string[]
  sources?: Array<{
    id?: string
    name?: string
    languageCodes?: string[]
    isDefault?: boolean
  }>
  [key: string]: unknown
}

export interface InstalledPlugin {
  id: string
  name: string
  tag: string
  endpoint: string
  enabled: boolean
  contentTypes: string[]
  languageCodes: string[]
  sourceId?: string
  sourceName?: string
}

interface NormalizedChapter {
  siteId?: string
  siteLink?: string
  name: string
  number: string
  pages: Array<Record<string, unknown>>
  raw: Record<string, unknown>
}

export interface SearchResultItem {
  id: string
  pluginId: string
  pluginName: string
  pluginTag: string
  endpoint: string
  sourceId?: string
  sourceName?: string
  contentType: string
  title: string
  description: string
  cover: string
  siteId: string
  siteLink: string
  languages: string[]
  chapterCount: number | null
  rawComic: Record<string, unknown>
}

export interface SearchResultDetails {
  description: string
  cover: string
  chapterCount: number
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const stableId = (...values: Array<string | undefined>): string => {
  const joined = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => normalizeToken(value))
    .filter(Boolean)
    .join(':')
  return joined || `id:${Date.now()}`
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const pickString = (value: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const raw = value[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    if (typeof raw === 'number') return String(raw)
  }
  return ''
}

const pickArrayStrings = (value: Record<string, unknown>, keys: string[]): string[] => {
  for (const key of keys) {
    const raw = value[key]
    if (Array.isArray(raw)) {
      const parsed = raw
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
      if (parsed.length) return parsed
    }
    if (typeof raw === 'string' && raw.trim()) {
      if (raw.includes(',')) {
        const parsed = raw
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
        if (parsed.length) return parsed
      }
      return [raw.trim()]
    }
  }
  return []
}

const parsePagesValue = (raw: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(raw)) {
    return raw.map(asRecord).filter((item) => Object.keys(item).length > 0)
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map(asRecord).filter((item) => Object.keys(item).length > 0)
      }
    } catch {
      return []
    }
  }
  return []
}

const needsDetailsFetch = (result: SearchResultItem): boolean => {
  const descriptionFromSearch =
    pickString(result.rawComic, ['synopsis', 'description']) || result.description
  const coverFromSearch = pickString(result.rawComic, ['cover']) || result.cover
  return !descriptionFromSearch || !coverFromSearch
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 30_000): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Plugin request timed out')), timeoutMs)
    })
  ])

const postPlugin = async <T>(
  endpoint: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> => {
  const response = await withTimeout(
    fetch(`${normalizeBaseUrl(endpoint)}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  )

  if (!response.ok) {
    throw new Error(`Plugin request failed (${response.status}) at ${path}`)
  }
  return (await response.json()) as T
}

const normalizePlugin = (record: DbRecord<PluginRecordData>): InstalledPlugin | null => {
  const endpoint = record.data.endpoint || record.data.url
  if (!endpoint || typeof endpoint !== 'string') return null

  const contentTypes = Array.isArray(record.data.contentTypes)
    ? record.data.contentTypes.filter((value): value is string => typeof value === 'string')
    : []
  if (contentTypes.length > 0 && !contentTypes.some((type) => ['comic', 'manga'].includes(type))) {
    return null
  }

  const defaultSource =
    record.data.sources?.find((source) => source?.isDefault) || record.data.sources?.[0]

  return {
    id: record.id,
    name: record.data.name || record.data.tag || record.id,
    tag: record.data.tag || record.id,
    endpoint: normalizeBaseUrl(endpoint),
    enabled: record.data.enabled !== false,
    contentTypes: contentTypes.length > 0 ? contentTypes : ['comic'],
    languageCodes: Array.isArray(record.data.languageCodes)
      ? record.data.languageCodes.filter((entry): entry is string => typeof entry === 'string')
      : [],
    sourceId: defaultSource?.id,
    sourceName: defaultSource?.name
  }
}

const deriveLanguages = (
  rawComic: Record<string, unknown>,
  details: Record<string, unknown>,
  plugin: InstalledPlugin
): string[] => {
  const fromComic = pickArrayStrings(rawComic, ['languageCodes', 'languages'])
  if (fromComic.length) return fromComic

  const language = pickString(rawComic, ['language', 'lang']) || pickString(details, ['language', 'lang'])
  if (language) return [language]

  return plugin.languageCodes.length > 0 ? plugin.languageCodes : ['unknown']
}

const normalizeChapters = async (
  plugin: InstalledPlugin,
  rawComic: Record<string, unknown>,
  chaptersRaw: unknown[]
): Promise<NormalizedChapter[]> => {
  const comicSiteId = pickString(rawComic, ['siteId', 'id'])
  const chapters = chaptersRaw.map(asRecord).filter((chapter) => Object.keys(chapter).length > 0)
  const normalized: NormalizedChapter[] = []

  for (const chapter of chapters) {
    let pages = parsePagesValue(chapter.pages ?? chapter.pictures ?? chapter.images)
    if (pages.length === 0) {
      try {
        const chapterSiteId = pickString(chapter, ['siteId', 'id'])
        const fetchedPages = await postPlugin<Array<Record<string, unknown>>>(plugin.endpoint, 'getPages', {
          siteId: comicSiteId,
          chapterSiteId
        })
        pages = parsePagesValue(fetchedPages)
      } catch {
        pages = []
      }
    }

    if (pages.length === 0) continue

    normalized.push({
      siteId: pickString(chapter, ['siteId', 'id']),
      siteLink: pickString(chapter, ['siteLink', 'url', 'path']),
      name: pickString(chapter, ['name', 'title']),
      number: pickString(chapter, ['number', 'chapterNumber']),
      pages,
      raw: chapter
    })
  }

  return normalized
}

const normalizeSearchResult = (plugin: InstalledPlugin, rawComicInput: unknown): SearchResultItem | null => {
  const rawComic = asRecord(rawComicInput)
  const siteId = pickString(rawComic, ['siteId', 'id'])
  const title = pickString(rawComic, ['name', 'title'])
  if (!siteId || !title) return null

  const details: Record<string, unknown> = {}
  const description = pickString(rawComic, ['synopsis', 'description'])
  const cover = pickString(rawComic, ['cover']) || ''
  const siteLink = pickString(rawComic, ['siteLink', 'url', 'path'])
  const contentType = pickString(rawComic, ['contentType', 'type']) || plugin.contentTypes[0] || 'comic'
  const chapterCountRaw = pickString(rawComic, ['chapterCount', 'chaptersCount', 'totalChapters'])
  const chapterCount = chapterCountRaw ? Number(chapterCountRaw) : null

  return {
    id: stableId('result', plugin.tag, siteId),
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginTag: plugin.tag,
    endpoint: plugin.endpoint,
    sourceId: plugin.sourceId,
    sourceName: plugin.sourceName,
    contentType,
    title,
    description,
    cover,
    siteId,
    siteLink,
    languages: deriveLanguages(rawComic, details, plugin),
    chapterCount: Number.isFinite(chapterCount) ? chapterCount : null,
    rawComic
  }
}

export const listInstalledContentPlugins = (
  records: Array<DbRecord<PluginRecordData>>
): InstalledPlugin[] =>
  records
    .map(normalizePlugin)
    .filter((plugin): plugin is InstalledPlugin => plugin !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

export const searchByPlugins = async (
  plugins: InstalledPlugin[],
  query: string
): Promise<SearchResultItem[]> => {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }
  const byPlugin = await Promise.all(
    plugins.map(async (plugin) => {
      try {
        const baseList = await postPlugin<unknown[]>(plugin.endpoint, 'search', { search: trimmed })

        const limited = baseList.slice(0, 25)
        return limited
          .map((item) => normalizeSearchResult(plugin, item))
          .filter((item): item is SearchResultItem => item !== null)
      } catch {
        return []
      }
    })
  )

  return byPlugin
    .flat()
    .sort((a, b) => a.title.localeCompare(b.title))
}

export const addSearchResultToDatabase = async (result: SearchResultItem): Promise<void> => {
  let details: Record<string, unknown> = {}
  if (needsDetailsFetch(result)) {
    details = asRecord(
      await postPlugin<Record<string, unknown>>(result.endpoint, 'getDetails', {
        siteId: result.siteId
      })
    )
  }

  const chaptersRaw = await postPlugin<unknown[]>(result.endpoint, 'getChapters', {
    siteId: result.siteId
  })

  const plugin: InstalledPlugin = {
    id: result.pluginId,
    name: result.pluginName,
    tag: result.pluginTag,
    endpoint: result.endpoint,
    enabled: true,
    contentTypes: [result.contentType],
    languageCodes: result.languages,
    sourceId: result.sourceId,
    sourceName: result.sourceName
  }

  const chapters = await normalizeChapters(plugin, result.rawComic, chaptersRaw)

  const comicId = stableId('comic', result.pluginTag, result.siteId || result.siteLink || result.title)
  const comicData: Record<string, unknown> = {
    name: result.title,
    synopsis: result.description,
    cover: result.cover || null,
    siteId: result.siteId,
    siteLink: result.siteLink || null,
    sourceTag: result.pluginTag,
    sourceName: result.sourceName || result.pluginName,
    sourceId: result.sourceId || null,
    pluginId: result.pluginId,
    pluginEndpoint: result.endpoint,
    contentType: result.contentType,
    languageCodes: result.languages,
    hasOffline: false,
    offline: 0,
    ...result.rawComic,
    ...details
  }

  await dbUpsert('comics', comicData, comicId)

  const validChapters = chapters.filter((chapter) => chapter.pages.length > 0)
  for (let index = 0; index < validChapters.length; index += 1) {
    const chapter = validChapters[index]
    const chapterId = stableId(
      'chapter',
      comicId,
      chapter.siteId || chapter.number || chapter.name || String(index + 1)
    )

    const chapterData: Record<string, unknown> = {
      ...chapter.raw,
      comicId,
      siteId: chapter.siteId || null,
      siteLink: chapter.siteLink || null,
      number: chapter.number || String(index + 1),
      name: chapter.name || '',
      pages: chapter.pages,
      sourceTag: result.pluginTag,
      sourceName: result.sourceName || result.pluginName,
      sourceId: result.sourceId || null,
      languageCodes: result.languages,
      hasOffline: false,
      offline: 0
    }

    await dbUpsert('chapters', chapterData, chapterId)
  }
}

export const loadSearchResultDetails = async (
  result: SearchResultItem
): Promise<SearchResultDetails> => {
  let details: Record<string, unknown> = {}
  if (needsDetailsFetch(result)) {
    details = asRecord(
      await postPlugin<Record<string, unknown>>(result.endpoint, 'getDetails', {
        siteId: result.siteId
      })
    )
  }

  const description =
    pickString(details, ['synopsis', 'description']) ||
    pickString(result.rawComic, ['synopsis', 'description']) ||
    result.description ||
    ''
  const cover =
    pickString(details, ['cover']) || pickString(result.rawComic, ['cover']) || result.cover || ''

  return {
    description,
    cover,
    chapterCount: result.chapterCount ?? 0
  }
}
