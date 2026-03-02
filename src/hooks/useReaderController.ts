import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import i18n from 'i18n'
import {
  type CanonicalChapterData,
  type ChapterMappingData,
  type ChapterVariantData,
  type ResolvedPage,
  type WorkData,
  dbUpsert,
  normalizeChapterPages,
  resolveChapterVariants,
  restQueryKeys,
  useDbFindQuery,
  useDbListQuery,
  useDbUpsertMutation
} from 'services'
import { type HorizontalReaderSlide } from 'components/TemplateComponents/Reader'

interface ReadProgressData {
  chapterId: string
  comicId: string
  page: number
  totalPages: number
  [key: string]: unknown
}

interface PluginRecordData {
  endpoint?: string
  url?: string
  enabled?: boolean
  name?: string
  tag?: string
  contentTypes?: string[]
  languageCodes?: string[]
  capabilities?: string[] | { metadata?: boolean; content?: boolean }
  sources?: Array<{ id?: string; name?: string; isDefault?: boolean }>
  [key: string]: unknown
}

interface InstalledContentPlugin {
  id: string
  endpoint: string
  name: string
  tag: string
  languageCodes: string[]
  sourceId?: string
  sourceName?: string
}

interface PluginSearchComic {
  siteId: string
  name: string
}

interface PluginChapter {
  siteId: string
  number?: string
  name?: string
  language?: string
  languageCodes?: string[]
  siteLink?: string
}

const normalizeImageSrc = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length ? normalized : undefined
}

const AUTO_LANGUAGE_MODE = '__auto__'

const normalizeLanguageCode = (value: string): string => value.trim().toLowerCase().replace(/_/g, '-')

const preferredLanguageCodes = (): string[] => {
  const resolved = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || 'en')
  const base = resolved.split('-')[0]
  return Array.from(new Set([resolved, base, 'en']))
}

const chapterLanguageModeFromSettings = (work?: { data?: WorkData } | null): string => {
  const settings = work?.data?.settings as Record<string, unknown> | undefined
  const raw = typeof settings?.chapterLanguageMode === 'string' ? settings.chapterLanguageMode : ''
  if (raw.trim() === AUTO_LANGUAGE_MODE) return AUTO_LANGUAGE_MODE
  return raw.trim() ? normalizeLanguageCode(raw) : AUTO_LANGUAGE_MODE
}

const titleToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()

const titleMatchScore = (query: string, title: string): number => {
  const left = titleToken(query)
  const right = titleToken(title)
  if (!left || !right) return 0
  if (left === right) return 1
  if (right.includes(left) || left.includes(right)) return 0.92

  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union > 0 ? overlap / union : 0
}

const chapterNumberToken = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const raw = value.trim().replace(',', '.')
  if (!raw) return ''
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) return String(parsed)
  const match = raw.match(/-?\d+(?:\.\d+)?/)
  if (!match) return raw.toLowerCase()
  return String(Number(match[0]))
}

const parsePluginCapabilities = (raw: PluginRecordData['capabilities']): { content: boolean } => {
  if (Array.isArray(raw)) {
    return { content: raw.map((entry) => entry.toLowerCase()).includes('content') }
  }
  if (raw && typeof raw === 'object') {
    return { content: (raw as { content?: boolean }).content !== false }
  }
  return { content: true }
}

const resolveInstalledContentPlugins = (
  records: Array<{ id: string; data: PluginRecordData }>
): InstalledContentPlugin[] => {
  const plugins: InstalledContentPlugin[] = []
  for (const record of records) {
      const endpoint = typeof record.data.endpoint === 'string' ? record.data.endpoint : record.data.url
      if (!endpoint || typeof endpoint !== 'string') continue
      if (record.data.enabled === false) continue

      const capabilities = parsePluginCapabilities(record.data.capabilities)
      if (!capabilities.content) continue

      const contentTypes = Array.isArray(record.data.contentTypes)
        ? record.data.contentTypes.filter((entry): entry is string => typeof entry === 'string')
        : []
      if (contentTypes.length > 0 && !contentTypes.some((type) => ['manga', 'comic'].includes(type))) {
        continue
      }

      const defaultSource = record.data.sources?.find((source) => source?.isDefault) || record.data.sources?.[0]
      plugins.push({
        id: record.id,
        endpoint: endpoint.replace(/\/+$/, ''),
        name: record.data.name || record.data.tag || record.id,
        tag: record.data.tag || record.id,
        languageCodes: Array.isArray(record.data.languageCodes)
          ? record.data.languageCodes.filter((entry): entry is string => typeof entry === 'string')
          : [],
        sourceId: defaultSource?.id,
        sourceName: defaultSource?.name
      })
  }
  return plugins
}

const parseFetchedPages = (raw: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(raw)) return []
  const pages: Array<Record<string, unknown>> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const urlRaw =
      (typeof item.url === 'string' && item.url) ||
      (typeof item.path === 'string' && item.path) ||
      (typeof item.src === 'string' && item.src) ||
      ''
    const url = urlRaw.trim()
    if (!url) continue
    const fileNameRaw =
      (typeof item.fileName === 'string' && item.fileName) ||
      (typeof item.filename === 'string' && item.filename) ||
      (typeof item.name === 'string' && item.name) ||
      'page'
    pages.push({ url, fileName: fileNameRaw.trim() || 'page' })
  }
  return pages
}

const postPlugin = async <T>(
  endpoint: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> => {
  const response = await fetch(`${endpoint}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    throw new Error(`Plugin request failed (${response.status}) at ${path}`)
  }
  return (await response.json()) as T
}

export const useReaderController = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { comicId, chapterId } = useParams<{ comicId: string; chapterId: string }>()

  const [readingMode, setReadingMode] = useState<'horizontal' | 'vertical'>('horizontal')
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>('ltr')
  const [doublePageSpread, setDoublePageSpread] = useState(false)
  const [readProgress, setReadProgress] = useState<ReadProgressData | null>(null)
  const [zoomVisible, setZoomVisible] = useState(false)
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [desktopControlsVisible, setDesktopControlsVisible] = useState(true)
  const [verticalDesktopPageHeight, setVerticalDesktopPageHeight] = useState(0)
  const [horizontalViewportWidth, setHorizontalViewportWidth] = useState(0)
  const [horizontalViewportNode, setHorizontalViewportNode] = useState<HTMLDivElement | null>(null)
  const [verticalScrollContainerNode, setVerticalScrollContainerNode] =
    useState<HTMLDivElement | null>(null)
  const [pageAspectMap, setPageAspectMap] = useState<Record<number, 'portrait' | 'landscape'>>({})
  const [isResolvingPages, setIsResolvingPages] = useState(false)
  const [pageResolveError, setPageResolveError] = useState(false)

  const mainContainerRef = useRef<HTMLDivElement>(null)
  const verticalPageRefs = useRef<Array<HTMLDivElement | null>>([])
  const pendingVerticalSyncRef = useRef(false)
  const pendingVerticalScrollBehaviorRef = useRef<ScrollBehavior>('auto')
  const initialVerticalSyncChapterRef = useRef<string | null>(null)
  const readProgressRecordIdRef = useRef<string | undefined>(undefined)
  const persistDebounceRef = useRef<number | null>(null)
  const persistReadProgressRef = useRef<(next: ReadProgressData) => Promise<void>>(async () => {})
  const lastPersistedRef = useRef<{ chapterId: string; page: number } | null>(null)
  const verticalScrollDebounceRef = useRef<number | null>(null)
  const desktopControlsHideTimeoutRef = useRef<number | null>(null)
  const triedPageResolveChapterIdsRef = useRef<Set<string>>(new Set())

  const worksQuery = useDbListQuery<WorkData>('works', 500, 0)
  const pluginsQuery = useDbListQuery<PluginRecordData>('plugins', 500, 0)
  const canonicalChaptersQuery = useDbFindQuery<CanonicalChapterData>(
    'canonical_chapters',
    'workId',
    comicId ?? '',
    5000,
    Boolean(comicId)
  )
  const chapterVariantsQuery = useDbFindQuery<ChapterVariantData>(
    'chapter_variants',
    'workId',
    comicId ?? '',
    5000,
    Boolean(comicId)
  )
  const chapterMappingsQuery = useDbFindQuery<ChapterMappingData>(
    'chapter_mappings',
    'workId',
    comicId ?? '',
    5000,
    Boolean(comicId)
  )
  const readProgressQuery = useDbFindQuery<ReadProgressData>(
    'read_progress',
    'chapterId',
    chapterId ?? '',
    1,
    Boolean(chapterId)
  )
  const upsertReadProgressMutation = useDbUpsertMutation<ReadProgressData>()
  const upsertWorkMutation = useDbUpsertMutation<WorkData>()

  const setHorizontalViewportRef = useCallback((node: HTMLDivElement | null) => {
    setHorizontalViewportNode(node)
    setHorizontalViewportWidth(node?.clientWidth ?? 0)
  }, [])

  const setVerticalScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setVerticalScrollContainerNode(node)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobileViewport(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const showDesktopControls = useCallback(() => {
    if (isMobileViewport) return
    setDesktopControlsVisible(true)
    if (desktopControlsHideTimeoutRef.current !== null) {
      window.clearTimeout(desktopControlsHideTimeoutRef.current)
    }
    desktopControlsHideTimeoutRef.current = window.setTimeout(() => {
      setDesktopControlsVisible(false)
    }, 1800)
  }, [isMobileViewport])

  useEffect(() => {
    if (isMobileViewport) {
      setDesktopControlsVisible(true)
      if (desktopControlsHideTimeoutRef.current !== null) {
        window.clearTimeout(desktopControlsHideTimeoutRef.current)
        desktopControlsHideTimeoutRef.current = null
      }
      return
    }

    showDesktopControls()
  }, [isMobileViewport, showDesktopControls, chapterId, readingMode])

  useEffect(() => {
    return () => {
      if (desktopControlsHideTimeoutRef.current !== null) {
        window.clearTimeout(desktopControlsHideTimeoutRef.current)
      }
    }
  }, [])

  const work = useMemo(
    () => worksQuery.data?.find((record) => record.id === comicId) ?? null,
    [worksQuery.data, comicId]
  )

  const availableChapterLanguages = useMemo(() => {
    const languages = new Set<string>()
    for (const variant of chapterVariantsQuery.data ?? []) {
      const languageCodes = Array.isArray(variant.data.languageCodes) ? variant.data.languageCodes : []
      for (const entry of languageCodes) {
        if (typeof entry !== "string") continue
        const normalized = normalizeLanguageCode(entry)
        if (normalized) languages.add(normalized)
      }

      if (typeof variant.data.language === 'string') {
        const normalized = normalizeLanguageCode(variant.data.language)
        if (normalized) languages.add(normalized)
      }
    }

    return [...languages].sort((left, right) => left.localeCompare(right))
  }, [chapterVariantsQuery.data])

  const selectedChapterLanguage = useMemo(() => {
    const savedMode = chapterLanguageModeFromSettings(work)
    if (savedMode === AUTO_LANGUAGE_MODE) return AUTO_LANGUAGE_MODE
    return availableChapterLanguages.includes(savedMode) ? savedMode : AUTO_LANGUAGE_MODE
  }, [availableChapterLanguages, work])

  const chapterLanguagePriority = useMemo(() => {
    if (selectedChapterLanguage !== AUTO_LANGUAGE_MODE) {
      return selectedChapterLanguage ? [selectedChapterLanguage] : []
    }

    const appPreferred = preferredLanguageCodes()
    const remaining = availableChapterLanguages.filter((language) => {
      const normalized = normalizeLanguageCode(language)
      return !appPreferred.includes(normalized)
    })

    return Array.from(new Set([...appPreferred, ...remaining]))
  }, [availableChapterLanguages, selectedChapterLanguage])

  const strictLanguageFilter = selectedChapterLanguage !== AUTO_LANGUAGE_MODE

  const chapters = useMemo(
    () =>
      resolveChapterVariants(
        canonicalChaptersQuery.data ?? [],
        chapterMappingsQuery.data ?? [],
        chapterVariantsQuery.data ?? [],
        chapterLanguagePriority,
        strictLanguageFilter
      ),
    [
      canonicalChaptersQuery.data,
      chapterMappingsQuery.data,
      chapterVariantsQuery.data,
      chapterLanguagePriority,
      strictLanguageFilter
    ]
  )

  const chapterIndex = useMemo(
    () =>
      chapters.findIndex((chapter) => {
        if (chapter.id === chapterId) return true
        return chapter.data.variantChapterId === chapterId
      }),
    [chapters, chapterId]
  )

  const currentChapter = chapterIndex >= 0 ? chapters[chapterIndex] : null
  const currentVariantChapterId =
    typeof currentChapter?.data.variantChapterId === 'string' ? currentChapter.data.variantChapterId : undefined
  const pages = useMemo<ResolvedPage[]>(
    () => normalizeChapterPages(currentChapter?.data.pages),
    [currentChapter?.id, currentChapter?.data.pages]
  )
  const legacyReadProgressQuery = useDbFindQuery<ReadProgressData>(
    'read_progress',
    'chapterId',
    currentVariantChapterId ?? '',
    1,
    Boolean(currentVariantChapterId && currentVariantChapterId !== chapterId)
  )
  const totalPages = pages.length

  const chapterPagesQuery = useMemo(
    () => ({
      isLoading:
        worksQuery.isLoading ||
        pluginsQuery.isLoading ||
        canonicalChaptersQuery.isLoading ||
        chapterMappingsQuery.isLoading ||
        chapterVariantsQuery.isLoading ||
        isResolvingPages,
      isError:
        worksQuery.isError ||
        pluginsQuery.isError ||
        canonicalChaptersQuery.isError ||
        chapterMappingsQuery.isError ||
        chapterVariantsQuery.isError ||
        pageResolveError
    }),
    [
      worksQuery.isLoading,
      worksQuery.isError,
      pluginsQuery.isLoading,
      pluginsQuery.isError,
      canonicalChaptersQuery.isLoading,
      canonicalChaptersQuery.isError,
      chapterMappingsQuery.isLoading,
      chapterMappingsQuery.isError,
      chapterVariantsQuery.isLoading,
      chapterVariantsQuery.isError,
      isResolvingPages,
      pageResolveError
    ]
  )

  const safePage = useMemo(() => {
    const page = readProgress?.page ?? 1
    return Math.max(1, Math.min(page, Math.max(1, totalPages || 1)))
  }, [readProgress?.page, totalPages])

  const chapterName =
    (typeof currentChapter?.data.name === 'string' && currentChapter.data.name) ||
    (typeof currentChapter?.data.number === 'string' && currentChapter.data.number) ||
    chapterId ||
    '-'

  const comicName =
    (typeof work?.data.title === 'string' && work.data.title) ||
    (typeof work?.data.name === 'string' && work.data.name) ||
    comicId ||
    'Reader'
  const canUseDoublePageSpread = doublePageSpread && !isMobileViewport
  const canUseCustomZoom = !isMobileViewport && readingMode === 'horizontal'

  const persistWorkSettings = useCallback(
    async (
      nextMode: 'horizontal' | 'vertical',
      nextDirection: 'ltr' | 'rtl',
      nextDoublePageSpread: boolean
    ) => {
      if (!work) return
      const nextData: WorkData = {
        ...(work.data as WorkData),
        settings: {
          ...(work.data.settings as Record<string, unknown> | undefined),
          readingMode: nextMode,
          readingDirection: nextDirection,
          doublePageSpread: nextDoublePageSpread
        }
      }
      await upsertWorkMutation.mutateAsync({
        table: 'works',
        data: nextData,
        id: work.id
      })
      queryClient.invalidateQueries({ queryKey: restQueryKeys.dbList('works', 500, 0) })
    },
    [work, upsertWorkMutation, queryClient]
  )

  const persistReadProgress = useCallback(
    async (next: ReadProgressData) => {
      const persistedReadProgress = await upsertReadProgressMutation.mutateAsync({
        table: 'read_progress',
        data: next,
        id: readProgressRecordIdRef.current ?? next.chapterId
      })
      readProgressRecordIdRef.current = persistedReadProgress.id
      queryClient.setQueryData(
        restQueryKeys.dbFind('read_progress', 'chapterId', next.chapterId, 1),
        [persistedReadProgress]
      )
      void queryClient.invalidateQueries({
        queryKey: restQueryKeys.dbFind('read_progress', 'comicId', next.comicId, 5000)
      })

      lastPersistedRef.current = { chapterId: next.chapterId, page: next.page }
    },
    [upsertReadProgressMutation, queryClient]
  )

  useEffect(() => {
    persistReadProgressRef.current = persistReadProgress
  }, [persistReadProgress])

  useEffect(() => {
    if (!comicId) {
      navigate('/', { replace: true })
    }
  }, [comicId, navigate])

  useEffect(() => {
    if (!comicId || !chapterId || !currentChapter) return
    if (currentChapter.id === chapterId) return
    if (currentChapter.data.variantChapterId !== chapterId) return

    navigate(`/reader/${comicId}/${currentChapter.id}`, { replace: true })
  }, [comicId, chapterId, currentChapter, navigate])

  useEffect(() => {
    const settings = work?.data?.settings as Record<string, unknown> | undefined
    const savedMode = settings?.readingMode
    const savedDirection = settings?.readingDirection
    const savedDoublePageSpread = settings?.doublePageSpread

    setReadingMode(savedMode === 'vertical' ? 'vertical' : 'horizontal')
    setReadingDirection(savedDirection === 'rtl' ? 'rtl' : 'ltr')
    setDoublePageSpread(savedDoublePageSpread === true)
  }, [work?.id])

  useEffect(() => {
    setReadProgress(null)
    readProgressRecordIdRef.current = undefined
    lastPersistedRef.current = null
    initialVerticalSyncChapterRef.current = null
    pendingVerticalSyncRef.current = false
    if (verticalScrollDebounceRef.current !== null) {
      window.clearTimeout(verticalScrollDebounceRef.current)
      verticalScrollDebounceRef.current = null
    }
    setPageAspectMap({})
    setPageResolveError(false)
    setIsResolvingPages(false)
  }, [chapterId])

  useEffect(() => {
    if (!chapterId || !comicId || !currentChapter) return
    if (normalizeChapterPages(currentChapter.data.pages).length > 0) return
    if (typeof currentChapter.data.siteLink === 'string' && currentChapter.data.siteLink.trim()) return
    if (triedPageResolveChapterIdsRef.current.has(chapterId)) return
    if (!work) return

    triedPageResolveChapterIdsRef.current.add(chapterId)
    setIsResolvingPages(true)
    setPageResolveError(false)

    const run = async () => {
      const installedContentPlugins = resolveInstalledContentPlugins(pluginsQuery.data ?? [])
      if (installedContentPlugins.length === 0) {
        setPageResolveError(true)
        setIsResolvingPages(false)
        return
      }

      const workTitle =
        (typeof work.data.title === 'string' && work.data.title) ||
        (typeof work.data.name === 'string' && work.data.name) ||
        ''
      const chapterNumber = chapterNumberToken(currentChapter.data.number)
      const chapterName = typeof currentChapter.data.name === 'string' ? currentChapter.data.name : ''
      const preferredLanguages =
        chapterLanguagePriority.length > 0 ? chapterLanguagePriority : preferredLanguageCodes()
      const canonicalChapterId =
        (typeof currentChapter.data.canonicalChapterId === 'string' &&
          currentChapter.data.canonicalChapterId) ||
        (canonicalChaptersQuery.data?.some((entry) => entry.id === chapterId) ? chapterId : undefined)

      const candidatePlugins = [...installedContentPlugins].sort((a, b) => {
        const aLang = a.languageCodes.map(normalizeLanguageCode)
        const bLang = b.languageCodes.map(normalizeLanguageCode)
        const aScore = preferredLanguages.some((lang) => aLang.includes(lang)) ? 1 : 0
        const bScore = preferredLanguages.some((lang) => bLang.includes(lang)) ? 1 : 0
        return bScore - aScore
      })

      for (const plugin of candidatePlugins) {
        let siteId = ''
        const workSourceSiteId =
          typeof work.data.sourceSiteId === 'string' ? work.data.sourceSiteId.trim() : ''
        const workPluginId =
          typeof work.data.metadataPluginId === 'string' ? work.data.metadataPluginId.trim() : ''

        if (workPluginId === plugin.id && workSourceSiteId) {
          siteId = workSourceSiteId
        } else if (workTitle) {
          try {
            const searchRows = await postPlugin<PluginSearchComic[]>(plugin.endpoint, 'search', {
              search: workTitle,
              languageCodes: preferredLanguages
            })
            const best = [...searchRows]
              .map((row) => ({
                row,
                score: titleMatchScore(workTitle, typeof row?.name === 'string' ? row.name : '')
              }))
              .filter((entry) => entry.score >= 0.6)
              .sort((left, right) => right.score - left.score)[0]
            siteId = typeof best?.row?.siteId === 'string' ? best.row.siteId : ''
          } catch {
            siteId = ''
          }
        }

        if (!siteId) continue

        let chapters: PluginChapter[] = []
        try {
          chapters = await postPlugin<PluginChapter[]>(plugin.endpoint, 'getChapters', {
            siteId,
            languageCodes: preferredLanguages
          })
        } catch {
          continue
        }

        const withSameNumber = chapters.filter((entry) => {
          const rowNumber = chapterNumberToken(entry?.number)
          return chapterNumber ? rowNumber === chapterNumber : false
        })
        const chapterCandidates = withSameNumber.length > 0 ? withSameNumber : chapters

        const ranked = chapterCandidates
          .map((entry) => {
            const chapterLanguages = [
              ...(Array.isArray(entry.languageCodes) ? entry.languageCodes : []),
              typeof entry.language === 'string' ? entry.language : ''
            ]
              .map(normalizeLanguageCode)
              .filter(Boolean)
            const langRank = chapterLanguages.reduce((best, lang) => {
              const idx = preferredLanguages.findIndex(
                (preferred) => preferred === lang || preferred === lang.split('-')[0]
              )
              return idx >= 0 ? Math.min(best, idx) : best
            }, Number.MAX_SAFE_INTEGER)
            const nameScore = titleMatchScore(chapterName, typeof entry.name === 'string' ? entry.name : '')
            return { entry, langRank, nameScore }
          })
          .sort((left, right) => {
            if (left.langRank !== right.langRank) return left.langRank - right.langRank
            return right.nameScore - left.nameScore
          })

        const chapterMatch = ranked[0]?.entry
        const chapterSiteId = typeof chapterMatch?.siteId === 'string' ? chapterMatch.siteId : ''
        const chapterSiteLink =
          typeof chapterMatch?.siteLink === 'string' && chapterMatch.siteLink.trim()
            ? chapterMatch.siteLink.trim()
            : null
        if (!chapterSiteId && !chapterSiteLink) continue

        let pagesRaw: unknown[] = []
        if (chapterSiteId) {
          try {
            pagesRaw = await postPlugin<unknown[]>(plugin.endpoint, 'getPages', {
              siteId,
              chapterSiteId,
              languageCodes: preferredLanguages
            })
          } catch {
            if (!chapterSiteLink) continue
          }
        }

        const pages = parseFetchedPages(pagesRaw)
        if (pages.length === 0 && !chapterSiteLink) continue

        const existingVariant = (chapterVariantsQuery.data ?? []).find((variant) => {
          const samePlugin = variant.data.pluginId === plugin.id
          const sameNumber = chapterNumberToken(variant.data.number) === chapterNumber
          const sameSite = typeof variant.data.siteId === 'string' && variant.data.siteId === chapterSiteId
          return samePlugin && (sameSite || (chapterNumber && sameNumber))
        })

        const variantId = existingVariant?.id || `chapter-variant:${comicId}:${plugin.id}:${chapterSiteId}`
        await dbUpsert(
          'chapter_variants',
          {
            workId: comicId,
            pluginId: plugin.id,
            pluginTag: plugin.tag,
            pluginName: plugin.name,
            sourceId: plugin.sourceId || null,
            sourceName: plugin.sourceName || null,
            siteId: chapterSiteId || null,
            siteLink: chapterSiteLink,
            number: (typeof chapterMatch?.number === 'string' && chapterMatch.number) || currentChapter.data.number || '',
            name: (typeof chapterMatch?.name === 'string' && chapterMatch.name) || currentChapter.data.name || '',
            pages,
            languageCodes: preferredLanguages,
            raw: chapterMatch || {}
          },
          variantId
        )

        if (canonicalChapterId) {
          await dbUpsert(
            'chapter_mappings',
            {
              workId: comicId,
              canonicalChapterId,
              variantChapterId: variantId,
              strategy: 'runtime-content-resolve',
              confidence: 0.9,
              contentPluginId: plugin.id
            },
            `chapter-mapping:${canonicalChapterId}:${variantId}`
          )
        }

        await queryClient.invalidateQueries({
          queryKey: restQueryKeys.dbFind('chapter_variants', 'workId', comicId, 5000)
        })
        await queryClient.invalidateQueries({
          queryKey: restQueryKeys.dbFind('chapter_mappings', 'workId', comicId, 5000)
        })

        setIsResolvingPages(false)
        setPageResolveError(false)
        return
      }

      setPageResolveError(true)
      setIsResolvingPages(false)
    }

    void run()
  }, [
    chapterId,
    comicId,
    currentChapter,
    work,
    pluginsQuery.data,
    chapterVariantsQuery.data,
    canonicalChaptersQuery.data,
    chapterLanguagePriority,
    queryClient
  ])

  useEffect(() => {
    const needsLegacyReadProgress =
      Boolean(currentVariantChapterId) && currentVariantChapterId !== chapterId
    const legacyReadProgressReady = !needsLegacyReadProgress || legacyReadProgressQuery.isSuccess

    if (
      !chapterId ||
      !comicId ||
      !totalPages ||
      !readProgressQuery.isSuccess ||
      !legacyReadProgressReady ||
      readProgressQuery.fetchStatus !== 'idle'
    ) {
      return
    }

    if (readProgress?.chapterId === chapterId) return

    const record = readProgressQuery.data[0] ?? legacyReadProgressQuery.data?.[0]
    if (record?.data) {
      readProgressRecordIdRef.current = record.id
      const page = Math.max(1, Math.min(record.data.page || 1, totalPages))

      const nextProgress: ReadProgressData = {
        ...record.data,
        chapterId,
        comicId,
        totalPages,
        page
      }
      setReadProgress(nextProgress)
      lastPersistedRef.current = { chapterId, page }
      if (!readProgressQuery.data[0]) {
        void persistReadProgressRef.current(nextProgress)
      }
      return
    }

    const initial: ReadProgressData = {
      chapterId,
      comicId,
      page: 1,
      totalPages
    }
    setReadProgress(initial)
    lastPersistedRef.current = { chapterId, page: 1 }
    void persistReadProgressRef.current(initial)
  }, [
    chapterId,
    comicId,
    totalPages,
    currentVariantChapterId,
    readProgressQuery.isSuccess,
    legacyReadProgressQuery.isSuccess,
    readProgressQuery.fetchStatus,
    readProgressQuery.data,
    legacyReadProgressQuery.data,
    readProgress?.chapterId
  ])

  useEffect(() => {
    if (!chapterId && chapters.length && comicId) {
      navigate(`/reader/${comicId}/${chapters[0].id}`, { replace: true })
    }
  }, [chapterId, chapters, comicId, navigate])

  const setCurrentPage = useCallback(
    (page: number, options?: { syncScroll?: boolean; syncBehavior?: ScrollBehavior }) => {
      if (!chapterId || !comicId || !totalPages || !readProgress) return
      const nextPage = Math.max(1, Math.min(page, totalPages))
      if (nextPage === readProgress.page) return

      pendingVerticalSyncRef.current = Boolean(options?.syncScroll) && readingMode === 'vertical'
      if (pendingVerticalSyncRef.current) {
        pendingVerticalScrollBehaviorRef.current = options?.syncBehavior ?? 'auto'
      }
      setReadProgress({
        chapterId,
        comicId,
        page: nextPage,
        totalPages
      })
    },
    [chapterId, comicId, totalPages, readProgress, readingMode]
  )

  const horizontalSlides = useMemo<HorizontalReaderSlide[]>(() => {
    if (!pages.length) return []

    const orderedIndexes =
      readingDirection === 'rtl'
        ? Array.from({ length: pages.length }, (_, idx) => pages.length - 1 - idx)
        : Array.from({ length: pages.length }, (_, idx) => idx)

    const slides: HorizontalReaderSlide[] = []

    for (let pointer = 0; pointer < orderedIndexes.length; ) {
      const currentIndex = orderedIndexes[pointer]
      const nextIndex = pointer + 1 < orderedIndexes.length ? orderedIndexes[pointer + 1] : null

      const canPair =
        canUseDoublePageSpread &&
        nextIndex !== null &&
        pageAspectMap[currentIndex] === 'portrait' &&
        pageAspectMap[nextIndex] === 'portrait'

      const slideIndexes = canPair ? [currentIndex, nextIndex] : [currentIndex]

      const pagesForSlide = slideIndexes.map((originalIndex) => {
        const page = pages[originalIndex]
        const src = normalizeImageSrc(page.url)
        return {
          key: `${page.fileName}-${originalIndex}`,
          src,
          alt: `Page ${originalIndex + 1}`,
          originalIndex
        }
      })

      slides.push({
        key: pagesForSlide.map((item) => item.key).join('|'),
        pages: pagesForSlide
      })

      pointer += canPair ? 2 : 1
    }

    return slides
  }, [pages, readingDirection, canUseDoublePageSpread, pageAspectMap])

  const currentOriginalIndex = useMemo(
    () => Math.max(0, Math.min(safePage - 1, Math.max(0, pages.length - 1))),
    [safePage, pages.length]
  )

  const currentHorizontalSlideIndex = useMemo(() => {
    if (!horizontalSlides.length) return 0
    const idx = horizontalSlides.findIndex((slide) =>
      slide.pages.some((item) => item.originalIndex === currentOriginalIndex)
    )
    return idx >= 0 ? idx : 0
  }, [horizontalSlides, currentOriginalIndex])

  const displayedHorizontalPages = horizontalSlides[currentHorizontalSlideIndex]?.pages ?? []

  const verticalOrderedPages = useMemo(() => {
    const ordered = readingDirection === 'rtl' ? [...pages].reverse() : pages
    return ordered.map((page, index) => {
      const src = normalizeImageSrc(page.url)
      return {
        key: `${page.fileName}-${index}`,
        src,
        alt: `Page ${index + 1}`
      }
    })
  }, [pages, readingDirection])

  const goToChapter = useCallback(
    (index: number) => {
      if (
        readProgress &&
        (lastPersistedRef.current?.chapterId !== readProgress.chapterId ||
          lastPersistedRef.current?.page !== readProgress.page)
      ) {
        void persistReadProgressRef.current(readProgress)
      }

      if (!comicId) return
      if (index < 0 || index >= chapters.length) {
        navigate('/')
        return
      }
      navigate(`/reader/${comicId}/${chapters[index].id}`)
    },
    [chapters, comicId, navigate, readProgress]
  )

  const goToPreviousPage = useCallback(() => {
    if (!readProgress) return

    if (readingMode === 'horizontal') {
      if (currentHorizontalSlideIndex > 0) {
        const previousSlide = horizontalSlides[currentHorizontalSlideIndex - 1]
        const targetOriginalIndex = previousSlide.pages[0].originalIndex
        setCurrentPage(targetOriginalIndex + 1)
        return
      }
      if (readingDirection === 'rtl') {
        goToChapter(chapterIndex + 1)
      } else {
        goToChapter(chapterIndex - 1)
      }
      return
    }

    if (readProgress.page > 1) {
      setCurrentPage(readProgress.page - 1, { syncScroll: true, syncBehavior: 'smooth' })
      return
    }

    goToChapter(chapterIndex - 1)
  }, [
    readProgress,
    readingMode,
    readingDirection,
    currentHorizontalSlideIndex,
    horizontalSlides,
    setCurrentPage,
    goToChapter,
    chapterIndex
  ])

  const goToNextPage = useCallback(() => {
    if (!readProgress) return

    if (readingMode === 'horizontal') {
      if (currentHorizontalSlideIndex < horizontalSlides.length - 1) {
        const nextSlide = horizontalSlides[currentHorizontalSlideIndex + 1]
        const targetOriginalIndex = nextSlide.pages[0].originalIndex
        setCurrentPage(targetOriginalIndex + 1)
        return
      }
      if (readingDirection === 'rtl') {
        goToChapter(chapterIndex - 1)
      } else {
        goToChapter(chapterIndex + 1)
      }
      return
    }

    if (readProgress.page < readProgress.totalPages) {
      setCurrentPage(readProgress.page + 1, { syncScroll: true, syncBehavior: 'smooth' })
      return
    }

    goToChapter(chapterIndex + 1)
  }, [
    readProgress,
    readingMode,
    readingDirection,
    currentHorizontalSlideIndex,
    horizontalSlides,
    setCurrentPage,
    goToChapter,
    chapterIndex
  ])

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current !== null) {
        window.clearTimeout(persistDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!readProgress) return

    if (
      lastPersistedRef.current?.chapterId === readProgress.chapterId &&
      lastPersistedRef.current?.page === readProgress.page
    ) {
      return
    }

    if (persistDebounceRef.current !== null) {
      window.clearTimeout(persistDebounceRef.current)
    }

    const snapshot = { ...readProgress }
    persistDebounceRef.current = window.setTimeout(() => {
      void persistReadProgressRef.current(snapshot)
    }, 160)
  }, [readProgress])

  useEffect(() => {
    return () => {
      if (
        readProgress &&
        (lastPersistedRef.current?.chapterId !== readProgress.chapterId ||
          lastPersistedRef.current?.page !== readProgress.page)
      ) {
        void persistReadProgressRef.current(readProgress)
      }
    }
  }, [readProgress])

  useEffect(() => {
    if (readingMode !== 'horizontal' || !horizontalViewportNode) return

    const viewport = horizontalViewportNode
    const updateWidth = () => setHorizontalViewportWidth(viewport.clientWidth)

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(viewport)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [readingMode, chapterId, horizontalViewportNode])

  useEffect(() => {
    if (!pages.length || readingMode !== 'horizontal') return

    for (let index = 0; index < pages.length; index += 1) {
      if (pageAspectMap[index]) continue
      const img = new Image()
      img.onload = () => {
        const aspect = img.naturalHeight >= img.naturalWidth ? 'portrait' : 'landscape'
        setPageAspectMap((current) => (current[index] ? current : { ...current, [index]: aspect }))
      }
      img.src = pages[index].url
    }
  }, [pages, readingMode, pageAspectMap])

  useEffect(() => {
    if (readingMode !== 'vertical' || !verticalScrollContainerNode || !readProgress || !pages.length)
      return
    if (!isMobileViewport && verticalDesktopPageHeight <= 0) return

    const isInitialSync = initialVerticalSyncChapterRef.current !== chapterId
    if (!isInitialSync && !pendingVerticalSyncRef.current) return

    const container = verticalScrollContainerNode
    const targetIndex = Math.max(0, Math.min(safePage - 1, pages.length - 1))
    const targetNode = verticalPageRefs.current[targetIndex]
    if (!targetNode) return
    const targetTop = targetNode ? Math.max(0, targetNode.offsetTop) : 0
    const behavior = pendingVerticalScrollBehaviorRef.current

    pendingVerticalSyncRef.current = false
    pendingVerticalScrollBehaviorRef.current = 'auto'
    if (isInitialSync) {
      initialVerticalSyncChapterRef.current = chapterId ?? null
    }

    setIsScrollingProgrammatically(true)
    container.scrollTo({ top: targetTop, behavior })

    const timeout = window.setTimeout(() => setIsScrollingProgrammatically(false), 220)
    return () => window.clearTimeout(timeout)
  }, [
    readingMode,
    verticalScrollContainerNode,
    readProgress,
    safePage,
    chapterId,
    pages.length,
    isMobileViewport,
    verticalDesktopPageHeight
  ])

  useEffect(() => {
    if (readingMode !== 'vertical' || !verticalScrollContainerNode || !pages.length) return

    const container = verticalScrollContainerNode
    const computeCurrentPage = () => {
      if (isScrollingProgrammatically) return
      if (!container.clientHeight) return

      let pageIndex = 0
      if (!isMobileViewport) {
        pageIndex = Math.round(container.scrollTop / container.clientHeight)
      } else {
        const centerY = container.scrollTop + container.clientHeight / 2
        let bestDistance = Number.POSITIVE_INFINITY
        let bestIndex = 0
        for (let index = 0; index < pages.length; index += 1) {
          const node = verticalPageRefs.current[index]
          if (!node) continue
          const pageCenter = node.offsetTop + node.clientHeight / 2
          const distance = Math.abs(pageCenter - centerY)
          if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = index
          }
        }
        pageIndex = bestIndex
      }

      const page = Math.max(1, Math.min(pageIndex + 1, pages.length))
      pendingVerticalSyncRef.current = false
      setCurrentPage(page)
    }

    const handleScroll = () => {
      if (isScrollingProgrammatically) return
      if (verticalScrollDebounceRef.current !== null) {
        window.clearTimeout(verticalScrollDebounceRef.current)
      }
      verticalScrollDebounceRef.current = window.setTimeout(computeCurrentPage, 180)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (verticalScrollDebounceRef.current !== null) {
        window.clearTimeout(verticalScrollDebounceRef.current)
        verticalScrollDebounceRef.current = null
      }
    }
  }, [
    readingMode,
    verticalScrollContainerNode,
    pages.length,
    setCurrentPage,
    isScrollingProgrammatically,
    isMobileViewport
  ])

  useEffect(() => {
    if (readingMode !== 'vertical' || isMobileViewport || !verticalScrollContainerNode) return

    const container = verticalScrollContainerNode
    const updateHeight = () => setVerticalDesktopPageHeight(container.clientHeight)

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(container)
    window.addEventListener('resize', updateHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [readingMode, isMobileViewport, chapterId, verticalScrollContainerNode])

  useEffect(() => {
    const container = mainContainerRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent) => {
      if (readingMode === 'horizontal') {
        event.preventDefault()
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [readingMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
      }

      if (event.key === 'Escape') {
        navigate('/')
        return
      }

      if (event.key === 'ArrowLeft') {
        goToPreviousPage()
      }

      if (event.key === 'ArrowRight') {
        goToNextPage()
      }

      if (event.key === 'ArrowUp' && readingMode === 'vertical') {
        goToPreviousPage()
      }

      if (event.key === 'ArrowDown' && readingMode === 'vertical') {
        goToNextPage()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readingMode, goToPreviousPage, goToNextPage, navigate])

  const setReadingModeAndPersist = async (vertical: boolean) => {
    const next = vertical ? 'vertical' : 'horizontal'
    if (next === readingMode) return

    setReadingMode(next)
    if (next === 'vertical') {
      setZoomVisible(false)
      pendingVerticalSyncRef.current = true
    }
    await persistWorkSettings(next, readingDirection, doublePageSpread)
  }

  const setReadingDirectionAndPersist = async (rtl: boolean) => {
    const next = rtl ? 'rtl' : 'ltr'
    if (next === readingDirection) return
    setReadingDirection(next)
    await persistWorkSettings(readingMode, next, doublePageSpread)
  }

  const setDoublePageSpreadAndPersist = async (enabled: boolean) => {
    const next = Boolean(enabled)
    if (next === doublePageSpread) return
    setDoublePageSpread(next)
    await persistWorkSettings(readingMode, readingDirection, next)
  }

  const currentZoomImageKey = useMemo(() => {
    if (!chapterId || !pages.length) return ''
    if (readingMode === 'horizontal') {
      return displayedHorizontalPages.map((page) => page.key).join('|')
    }
    return `${chapterId}:${safePage}`
  }, [chapterId, pages.length, readingMode, displayedHorizontalPages, safePage])

  const externalChapterUrl =
    !pages.length && typeof currentChapter?.data.siteLink === 'string' && currentChapter.data.siteLink.trim()
      ? currentChapter.data.siteLink.trim()
      : null

  const openExternalChapter = useCallback(() => {
    if (!externalChapterUrl) return
    window.open(externalChapterUrl, '_blank', 'noopener,noreferrer')
  }, [externalChapterUrl])

  return {
    chapterPagesQuery,
    comicName,
    chapterName,
    readingMode,
    readingDirection,
    canUseDoublePageSpread,
    isMobileViewport,
    setReadingModeAndPersist,
    setReadingDirectionAndPersist,
    setDoublePageSpreadAndPersist,
    onClose: () => navigate('/'),
    desktopControlsVisible,
    showDesktopControls,
    mainContainerRef,
    canUseCustomZoom,
    zoomVisible,
    setZoomVisible,
    currentZoomImageKey,
    externalChapterUrl,
    openExternalChapter,
    pages,
    horizontalSlides,
    currentHorizontalSlideIndex,
    horizontalViewportWidth,
    setHorizontalViewportRef,
    goToPreviousPage,
    goToNextPage,
    verticalOrderedPages,
    verticalDesktopPageHeight,
    setVerticalScrollContainerRef,
    verticalPageRefs,
    safePage,
    totalPages,
    goToPreviousChapter: () => goToChapter(chapterIndex - 1),
    goToNextChapter: () => goToChapter(chapterIndex + 1),
    hasPreviousChapter: chapterIndex > 0,
    hasNextChapter: chapterIndex < chapters.length - 1
  }
}
