import { dbUpsert, type DbRecord } from 'services'
import i18n from 'i18n'

export interface PluginRecordData {
  endpoint?: string
  url?: string
  enabled?: boolean
  name?: string
  tag?: string
  contentTypes?: string[]
  languageCodes?: string[]
  capabilities?: string[] | { metadata?: boolean; content?: boolean }
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
  providesMetadata: boolean
  providesContent: boolean
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

interface CanonicalChapter {
  siteId?: string
  siteLink?: string
  name: string
  number: string
  languageCodes: string[]
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

export interface PluginSearchError {
  pluginId: string
  pluginName: string
  endpoint: string
  message: string
}

export interface SearchByPluginsResult {
  results: SearchResultItem[]
  errors: PluginSearchError[]
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const normalizeLanguageCode = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace('_', '-')

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const normalizeTitleToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()

const normalizeChapterNumber = (value: string): string => {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return String(parsed)
  return value.trim().toLowerCase()
}

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

const resolvePreferredLanguageCodes = (plugin?: InstalledPlugin): string[] => {
  const primary = i18n.resolvedLanguage || i18n.language || 'en'
  const normalizedPrimary = normalizeLanguageCode(primary || 'en')
  const basePrimary = normalizedPrimary.split('-')[0]

  const pluginLanguages = (plugin?.languageCodes || []).map(normalizeLanguageCode)
  const all = [normalizedPrimary, basePrimary, ...pluginLanguages].filter(Boolean)

  return Array.from(new Set(all))
}

const resolveCapabilities = (data: PluginRecordData): { metadata: boolean; content: boolean } => {
  const raw = data.capabilities
  if (Array.isArray(raw)) {
    const normalized = raw.map((entry) => entry.toLowerCase())
    return {
      metadata: normalized.includes('metadata'),
      content: normalized.includes('content')
    }
  }

  if (raw && typeof raw === 'object') {
    const parsed = raw as { metadata?: boolean; content?: boolean }
    return {
      metadata: parsed.metadata !== false,
      content: parsed.content !== false
    }
  }

  return { metadata: true, content: true }
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
  const capabilities = resolveCapabilities(record.data)

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
    providesMetadata: capabilities.metadata,
    providesContent: capabilities.content,
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
          chapterSiteId,
          languageCodes: resolvePreferredLanguageCodes(plugin)
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

const normalizeCanonicalChapters = (chaptersRaw: unknown[], fallbackLanguages: string[]): CanonicalChapter[] => {
  const chapters = chaptersRaw.map(asRecord).filter((chapter) => Object.keys(chapter).length > 0)

  return chapters.map((chapter, index) => {
    const number = pickString(chapter, ['number', 'chapterNumber']) || String(index + 1)
    const languageCodes = Array.from(
      new Set(
        [
          ...pickArrayStrings(chapter, ['languageCodes', 'languages']),
          pickString(chapter, ['language', 'lang']),
          ...fallbackLanguages
        ].filter(Boolean)
      )
    )

    return {
      siteId: pickString(chapter, ['siteId', 'id']) || undefined,
      siteLink: pickString(chapter, ['siteLink', 'url', 'path']) || undefined,
      name: pickString(chapter, ['name', 'title']),
      number,
      languageCodes,
      raw: chapter
    }
  })
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

const pickBestSearchMatch = (title: string, candidates: unknown[]): Record<string, unknown> | null => {
  const target = normalizeTitleToken(title)
  if (!target) return null

  let best: Record<string, unknown> | null = null
  let bestScore = -1
  for (const candidateRaw of candidates) {
    const candidate = asRecord(candidateRaw)
    const candidateTitle = pickString(candidate, ['name', 'title'])
    const normalizedCandidateTitle = normalizeTitleToken(candidateTitle)
    if (!normalizedCandidateTitle) continue

    let score = 0
    if (normalizedCandidateTitle === target) score += 100
    if (normalizedCandidateTitle.includes(target) || target.includes(normalizedCandidateTitle)) score += 20

    const targetWords = target.split(' ').filter(Boolean)
    const candidateWords = new Set(normalizedCandidateTitle.split(' ').filter(Boolean))
    for (const word of targetWords) {
      if (candidateWords.has(word)) score += 3
    }

    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

const fetchContentChaptersForResult = async (
  plugin: InstalledPlugin,
  result: SearchResultItem
): Promise<NormalizedChapter[]> => {
  const preferredLanguages = resolvePreferredLanguageCodes(plugin)
  let pluginComic = result.rawComic
  let siteId = result.siteId

  if (plugin.id !== result.pluginId) {
    const pluginSearchResults = await postPlugin<unknown[]>(plugin.endpoint, 'search', {
      search: result.title,
      languageCodes: preferredLanguages
    })
    const best = pickBestSearchMatch(result.title, pluginSearchResults)
    if (!best) return []
    pluginComic = best
    siteId = pickString(best, ['siteId', 'id'])
    if (!siteId) return []
  }

  const chaptersRaw = await postPlugin<unknown[]>(plugin.endpoint, 'getChapters', {
    siteId,
    languageCodes: preferredLanguages
  })

  return normalizeChapters(plugin, pluginComic, chaptersRaw)
}

export const listInstalledPlugins = (
  records: Array<DbRecord<PluginRecordData>>
): InstalledPlugin[] =>
  records
    .map(normalizePlugin)
    .filter((plugin): plugin is InstalledPlugin => plugin !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

export const listInstalledContentPlugins = (
  records: Array<DbRecord<PluginRecordData>>
): InstalledPlugin[] =>
  listInstalledPlugins(records).filter((plugin) => plugin.providesContent)

export const listInstalledMetadataPlugins = (
  records: Array<DbRecord<PluginRecordData>>
): InstalledPlugin[] =>
  listInstalledPlugins(records).filter((plugin) => plugin.providesMetadata)

export const searchByPlugins = async (
  plugins: InstalledPlugin[],
  query: string
): Promise<SearchByPluginsResult> => {
  const trimmed = query.trim()
  if (!trimmed) {
    return { results: [], errors: [] }
  }

  const metadataPlugins = plugins.filter((plugin) => plugin.providesMetadata)
  if (metadataPlugins.length === 0) {
    return { results: [], errors: [] }
  }

  const byPlugin = await Promise.all(
    metadataPlugins.map(async (plugin) => {
      try {
        const preferredLanguages = resolvePreferredLanguageCodes(plugin)
        const baseList = await postPlugin<unknown[]>(plugin.endpoint, 'search', {
          search: trimmed,
          languageCodes: preferredLanguages
        })

        const limited = baseList.slice(0, 25)
        return {
          results: limited
            .map((item) => normalizeSearchResult(plugin, item))
            .filter((item): item is SearchResultItem => item !== null),
          error: null as PluginSearchError | null
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown plugin error'
        return {
          results: [],
          error: {
            pluginId: plugin.id,
            pluginName: plugin.name,
            endpoint: plugin.endpoint,
            message
          } satisfies PluginSearchError
        }
      }
    })
  )

  const results = byPlugin
    .flatMap((entry) => entry.results)
    .sort((a, b) => a.title.localeCompare(b.title))

  const errors = byPlugin
    .map((entry) => entry.error)
    .filter((entry): entry is PluginSearchError => entry !== null)

  return { results, errors }
}

export const addSearchResultToDatabase = async (
  result: SearchResultItem,
  selectedPlugins: InstalledPlugin[]
): Promise<void> => {
  const metadataPlugin = selectedPlugins.find((plugin) => plugin.id === result.pluginId)
  const preferredLanguages = resolvePreferredLanguageCodes(metadataPlugin)
  let details: Record<string, unknown> = {}
  if (needsDetailsFetch(result)) {
    details = asRecord(
      await postPlugin<Record<string, unknown>>(result.endpoint, 'getDetails', {
        siteId: result.siteId,
        languageCodes: preferredLanguages
      })
    )
  }

  const metadataChaptersRaw = await postPlugin<unknown[]>(result.endpoint, 'getChapters', {
    siteId: result.siteId,
    languageCodes: preferredLanguages
  })

  const workId = stableId('work', result.pluginTag, result.siteId || result.siteLink || result.title)
  const sourceKey = `${result.pluginTag}:${result.siteId}`
  const workData: Record<string, unknown> = {
    title: result.title,
    description:
      pickString(details, ['synopsis', 'description']) ||
      pickString(result.rawComic, ['synopsis', 'description']) ||
      result.description ||
      '',
    cover:
      pickString(details, ['cover']) || pickString(result.rawComic, ['cover']) || result.cover || null,
    sourceKey,
    metadataPluginId: result.pluginId,
    metadataPluginTag: result.pluginTag,
    metadataPluginName: result.pluginName,
    sourceSiteId: result.siteId,
    sourceSiteLink: result.siteLink || null,
    contentType: result.contentType,
    languageCodes: result.languages,
    chapterCount: result.chapterCount,
    rawMetadata: { ...result.rawComic, ...details }
  }

  await dbUpsert('works', workData, workId)

  const canonicalChapters = normalizeCanonicalChapters(metadataChaptersRaw, result.languages)
  const canonicalByNumber = new Map<string, { id: string; number: string; name: string }>()

  for (let index = 0; index < canonicalChapters.length; index += 1) {
    const chapter = canonicalChapters[index]
    const canonicalChapterId = stableId(
      'canonical-chapter',
      workId,
      chapter.siteId || chapter.number || chapter.name || String(index + 1)
    )
    const chapterNumber = chapter.number || String(index + 1)
    const chapterData: Record<string, unknown> = {
      workId,
      number: chapterNumber,
      name: chapter.name || `Chapter ${chapterNumber}`,
      siteId: chapter.siteId || null,
      siteLink: chapter.siteLink || null,
      languageCodes: chapter.languageCodes,
      sourcePluginId: result.pluginId,
      sourcePluginTag: result.pluginTag,
      raw: chapter.raw
    }
    await dbUpsert('canonical_chapters', chapterData, canonicalChapterId)

    canonicalByNumber.set(normalizeChapterNumber(chapterNumber), {
      id: canonicalChapterId,
      number: chapterNumber,
      name: chapterData.name as string
    })
  }

  const contentPlugins = selectedPlugins.filter(
    (plugin) =>
      plugin.providesContent &&
      plugin.contentTypes.some((type) => ['comic', 'manga', result.contentType].includes(type))
  )

  let bestContentPlugin: InstalledPlugin | null = null
  let bestContentChapters: NormalizedChapter[] = []

  for (const contentPlugin of contentPlugins) {
    let contentChapters: NormalizedChapter[] = []
    try {
      contentChapters = await fetchContentChaptersForResult(contentPlugin, result)
    } catch {
      continue
    }
    if (contentChapters.length === 0) continue

    if (contentChapters.length > bestContentChapters.length) {
      bestContentPlugin = contentPlugin
      bestContentChapters = contentChapters
    }

    for (let index = 0; index < contentChapters.length; index += 1) {
      const chapter = contentChapters[index]
      const variantChapterId = stableId(
        'chapter-variant',
        workId,
        contentPlugin.tag,
        chapter.siteId || chapter.number || chapter.name || String(index + 1)
      )
      const chapterNumber = chapter.number || String(index + 1)

      const variantData: Record<string, unknown> = {
        workId,
        pluginId: contentPlugin.id,
        pluginTag: contentPlugin.tag,
        pluginName: contentPlugin.name,
        sourceId: contentPlugin.sourceId || null,
        sourceName: contentPlugin.sourceName || null,
        siteId: chapter.siteId || null,
        siteLink: chapter.siteLink || null,
        number: chapterNumber,
        name: chapter.name || `Chapter ${chapterNumber}`,
        pages: chapter.pages,
        languageCodes: result.languages,
        raw: chapter.raw
      }
      await dbUpsert('chapter_variants', variantData, variantChapterId)

      const mappedCanonical = canonicalByNumber.get(normalizeChapterNumber(chapterNumber))
      if (mappedCanonical) {
        const mappingId = stableId('chapter-mapping', mappedCanonical.id, variantChapterId)
        await dbUpsert(
          'chapter_mappings',
          {
            workId,
            canonicalChapterId: mappedCanonical.id,
            variantChapterId,
            strategy: 'number-match',
            confidence: 0.95,
            metadataPluginId: result.pluginId,
            contentPluginId: contentPlugin.id
          },
          mappingId
        )
      }
    }
  }

  const comicId = stableId('comic', result.pluginTag, result.siteId || result.siteLink || result.title)
  const comicData: Record<string, unknown> = {
    name: result.title,
    synopsis: workData.description,
    cover: workData.cover,
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
    workId,
    ...result.rawComic,
    ...details
  }

  await dbUpsert('comics', comicData, comicId)

  if (!bestContentPlugin || bestContentChapters.length === 0) return

  for (let index = 0; index < bestContentChapters.length; index += 1) {
    const chapter = bestContentChapters[index]
    const chapterId = stableId(
      'chapter',
      comicId,
      bestContentPlugin.tag,
      chapter.siteId || chapter.number || chapter.name || String(index + 1)
    )

    const chapterData: Record<string, unknown> = {
      ...chapter.raw,
      comicId,
      workId,
      siteId: chapter.siteId || null,
      siteLink: chapter.siteLink || null,
      number: chapter.number || String(index + 1),
      name: chapter.name || '',
      pages: chapter.pages,
      sourceTag: bestContentPlugin.tag,
      sourceName: bestContentPlugin.name,
      sourceId: bestContentPlugin.sourceId || null,
      pluginId: bestContentPlugin.id,
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
  const preferredLanguages = resolvePreferredLanguageCodes()
  let details: Record<string, unknown> = {}
  if (needsDetailsFetch(result)) {
    details = asRecord(
      await postPlugin<Record<string, unknown>>(result.endpoint, 'getDetails', {
        siteId: result.siteId,
        languageCodes: preferredLanguages
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
  const chapterCountFromDetails = Number(pickString(details, ['chapterCount', 'chaptersCount', 'totalChapters']))
  const chapterCount =
    Number.isFinite(chapterCountFromDetails) && chapterCountFromDetails >= 0
      ? chapterCountFromDetails
      : (result.chapterCount ?? 0)

  return {
    description,
    cover,
    chapterCount
  }
}
