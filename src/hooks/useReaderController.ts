import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  type ComicData,
  getChapterPageUrl,
  restQueryKeys,
  useChapterPagesQuery,
  useDbFindQuery,
  useDbUpsertMutation,
  useListChaptersByComicIdQuery,
  useListComicsQuery
} from 'services'
import { type HorizontalReaderSlide } from 'components/TemplateComponents/Reader'

interface ReadProgressData {
  chapterId: string
  comicId: string
  page: number
  totalPages: number
  [key: string]: unknown
}

const chapterNumberSortValue = (raw: unknown): number | null => {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  const direct = Number(normalized)
  if (Number.isFinite(direct)) return direct
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeImageSrc = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length ? normalized : undefined
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

  const comicsQuery = useListComicsQuery()
  const chaptersQuery = useListChaptersByComicIdQuery(comicId)
  const chapterPagesQuery = useChapterPagesQuery(chapterId)
  const readProgressQuery = useDbFindQuery<ReadProgressData>(
    'read_progress',
    'chapterId',
    chapterId ?? '',
    1,
    Boolean(chapterId)
  )
  const upsertReadProgressMutation = useDbUpsertMutation<ReadProgressData>()
  const upsertComicMutation = useDbUpsertMutation<ComicData>()

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

  const comic = useMemo(
    () => comicsQuery.data?.find((record) => record.id === comicId) ?? null,
    [comicsQuery.data, comicId]
  )

  const chapters = useMemo(() => {
    const items = [...(chaptersQuery.data ?? [])]
    items.sort((a, b) => {
      const av = chapterNumberSortValue(a.data.number)
      const bv = chapterNumberSortValue(b.data.number)
      if (av !== null && bv !== null && av !== bv) return av - bv
      if (av !== null && bv === null) return -1
      if (av === null && bv !== null) return 1
      const aNum = typeof a.data.number === 'string' ? a.data.number : ''
      const bNum = typeof b.data.number === 'string' ? b.data.number : ''
      return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' })
    })
    return items
  }, [chaptersQuery.data])

  const chapterIndex = useMemo(
    () => chapters.findIndex((chapter) => chapter.id === chapterId),
    [chapters, chapterId]
  )

  const pages = chapterPagesQuery.data?.pages ?? []
  const totalPages = pages.length

  const safePage = useMemo(() => {
    const page = readProgress?.page ?? 1
    return Math.max(1, Math.min(page, Math.max(1, totalPages || 1)))
  }, [readProgress?.page, totalPages])

  const chapterName =
    chapterPagesQuery.data?.chapterName ||
    (typeof chapters[chapterIndex]?.data.name === 'string' && chapters[chapterIndex]?.data.name) ||
    (typeof chapters[chapterIndex]?.data.number === 'string' &&
      chapters[chapterIndex]?.data.number) ||
    chapterId ||
    '-'

  const comicName = (typeof comic?.data.name === 'string' && comic.data.name) || comicId || 'Reader'
  const canUseDoublePageSpread = doublePageSpread && !isMobileViewport
  const canUseCustomZoom = !isMobileViewport && readingMode === 'horizontal'

  const persistComicSettings = useCallback(
    async (
      nextMode: 'horizontal' | 'vertical',
      nextDirection: 'ltr' | 'rtl',
      nextDoublePageSpread: boolean
    ) => {
      if (!comic) return
      const nextData: ComicData = {
        ...(comic.data as ComicData),
        settings: {
          ...(comic.data.settings as Record<string, unknown> | undefined),
          readingMode: nextMode,
          readingDirection: nextDirection,
          doublePageSpread: nextDoublePageSpread
        }
      }
      await upsertComicMutation.mutateAsync({
        table: 'comics',
        data: nextData,
        id: comic.id
      })

      queryClient.setQueryData(restQueryKeys.comics, (current) => {
        if (!Array.isArray(current)) return current
        return current.map((item) =>
          item && typeof item === 'object' && 'id' in item && item.id === comic.id
            ? { ...item, data: nextData }
            : item
        )
      })
    },
    [comic, upsertComicMutation, queryClient]
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
    const settings = comic?.data?.settings as Record<string, unknown> | undefined
    const savedMode = settings?.readingMode
    const savedDirection = settings?.readingDirection
    const savedDoublePageSpread = settings?.doublePageSpread

    setReadingMode(savedMode === 'vertical' ? 'vertical' : 'horizontal')
    setReadingDirection(savedDirection === 'rtl' ? 'rtl' : 'ltr')
    setDoublePageSpread(savedDoublePageSpread === true)
  }, [comic?.id])

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
  }, [chapterId])

  useEffect(() => {
    if (
      !chapterId ||
      !comicId ||
      !totalPages ||
      !readProgressQuery.isSuccess ||
      readProgressQuery.fetchStatus !== 'idle'
    ) {
      return
    }

    if (readProgress?.chapterId === chapterId) return

    const record = readProgressQuery.data[0]
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
    readProgressQuery.isSuccess,
    readProgressQuery.fetchStatus,
    readProgressQuery.data,
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
        const src = chapterId ? getChapterPageUrl(chapterId, originalIndex) : page.url
        return {
          key: `${page.fileName}-${originalIndex}`,
          src: normalizeImageSrc(src),
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
  }, [pages, readingDirection, canUseDoublePageSpread, pageAspectMap, chapterId])

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
      const originalIndex = readingDirection === 'rtl' ? pages.length - 1 - index : index
      const src = normalizeImageSrc(
        chapterId ? getChapterPageUrl(chapterId, originalIndex) : page.url
      )
      return {
        key: `${page.fileName}-${originalIndex}`,
        src,
        alt: `Page ${index + 1}`
      }
    })
  }, [pages, readingDirection, chapterId])

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
    if (!chapterId || !pages.length || readingMode !== 'horizontal') return

    for (let index = 0; index < pages.length; index += 1) {
      if (pageAspectMap[index]) continue
      const img = new Image()
      img.onload = () => {
        const aspect = img.naturalHeight >= img.naturalWidth ? 'portrait' : 'landscape'
        setPageAspectMap((current) => (current[index] ? current : { ...current, [index]: aspect }))
      }
      img.src = getChapterPageUrl(chapterId, index)
    }
  }, [chapterId, pages.length, readingMode, pageAspectMap])

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
        if (readingMode === 'vertical') {
          goToPreviousPage()
        } else if (readingDirection === 'rtl') {
          goToPreviousPage()
        } else {
          goToPreviousPage()
        }
      }

      if (event.key === 'ArrowRight') {
        if (readingMode === 'vertical') {
          goToNextPage()
        } else if (readingDirection === 'rtl') {
          goToNextPage()
        } else {
          goToNextPage()
        }
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
  }, [readingMode, readingDirection, goToPreviousPage, goToNextPage, navigate])

  const setReadingModeAndPersist = async (vertical: boolean) => {
    const next = vertical ? 'vertical' : 'horizontal'
    if (next === readingMode) return

    setReadingMode(next)
    if (next === 'vertical') {
      setZoomVisible(false)
      pendingVerticalSyncRef.current = true
    }
    await persistComicSettings(next, readingDirection, doublePageSpread)
  }

  const setReadingDirectionAndPersist = async (rtl: boolean) => {
    const next = rtl ? 'rtl' : 'ltr'
    if (next === readingDirection) return
    setReadingDirection(next)
    await persistComicSettings(readingMode, next, doublePageSpread)
  }

  const setDoublePageSpreadAndPersist = async (enabled: boolean) => {
    const next = Boolean(enabled)
    if (next === doublePageSpread) return
    setDoublePageSpread(next)
    await persistComicSettings(readingMode, readingDirection, next)
  }

  const currentZoomImageKey = useMemo(() => {
    if (!chapterId || !pages.length) return ''
    if (readingMode === 'horizontal') {
      return displayedHorizontalPages.map((page) => page.key).join('|')
    }
    return `${chapterId}:${safePage}`
  }, [chapterId, pages.length, readingMode, displayedHorizontalPages, safePage])

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
