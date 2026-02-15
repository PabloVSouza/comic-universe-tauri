import { ComponentProps, FC, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BgBox } from 'components'
import type { ComicData } from 'services'
import {
  getApiBaseUrl,
  useDbFindQuery,
  useListChaptersByComicIdQuery,
  useListComicsQuery
} from 'services'
import { cn } from 'utils'
import { MainContentHeader } from './MainContentHeader'
import { MainContentNav } from './MainContentNav'
import { MainContentChapterTable } from './MainContentChapterTable'

interface MainContentProps extends ComponentProps<'div'> {
  selectedComicId?: string | null
}

const normalizeText = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length ? value : undefined
}

interface ReadProgressData {
  chapterId?: string
  comicId?: string
  page?: number
  totalPages?: number
  [key: string]: unknown
}

const progressPercentFromReadProgress = (readProgress?: ReadProgressData): number => {
  if (!readProgress) return 0
  const totalPages = typeof readProgress.totalPages === 'number' ? readProgress.totalPages : 0
  const page = typeof readProgress.page === 'number' ? readProgress.page : 0
  if (totalPages <= 0) return 0
  const safePage = Math.max(0, Math.min(page, totalPages))
  return Math.max(0, Math.min(100, Math.round((safePage / totalPages) * 100)))
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

export const MainContent: FC<MainContentProps> = ({
  className,
  selectedComicId,
  ...props
}) => {
  const navigate = useNavigate()
  const comicsQuery = useListComicsQuery()
  const chaptersQuery = useListChaptersByComicIdQuery(selectedComicId)
  const readProgressQuery = useDbFindQuery<ReadProgressData>(
    'read_progress',
    'comicId',
    selectedComicId ?? '',
    5000,
    Boolean(selectedComicId)
  )
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const selectedComic = useMemo(
    () => comicsQuery.data?.find((comic) => comic.id === selectedComicId) ?? null,
    [comicsQuery.data, selectedComicId]
  )

  const chapters = chaptersQuery.data ?? []
  const deferredChapters = useDeferredValue(chapters)
  const hasSelectedChapters = selectedChapterIds.size > 0
  const sortedChapters = useMemo(() => {
    const items = [...deferredChapters]
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
  }, [deferredChapters])

  const readProgressByChapterId = useMemo(() => {
    const map = new Map<string, number>()
    for (const record of readProgressQuery.data ?? []) {
      const chapterId = typeof record.data.chapterId === 'string' ? record.data.chapterId : undefined
      if (!chapterId) continue
      map.set(chapterId, progressPercentFromReadProgress(record.data))
    }
    return map
  }, [readProgressQuery.data])

  const preferredReaderChapterId = useMemo(() => {
    const lastChapterWithProgress = [...sortedChapters]
      .reverse()
      .find((chapter) => (readProgressByChapterId.get(chapter.id) ?? 0) > 0)

    return lastChapterWithProgress?.id ?? sortedChapters[0]?.id ?? null
  }, [sortedChapters, readProgressByChapterId])

  const totalProgress = useMemo(() => {
    if (!deferredChapters.length) return 0
    const total = deferredChapters.reduce(
      (sum, chapter) => sum + (readProgressByChapterId.get(chapter.id) ?? 0),
      0
    )
    return Math.round(total / deferredChapters.length)
  }, [deferredChapters, readProgressByChapterId])

  useEffect(() => {
    setSelectedChapterIds(new Set())
    setIsSelectionMode(false)
  }, [selectedComicId])

  if (!selectedComicId) {
    return (
      <BgBox className={cn('relative min-h-0 overflow-auto p-4', className)} {...props}>
        <div className="rounded-md border border-border/50 bg-background p-3 text-sm text-muted-foreground">
          Select a comic to view details and chapters.
        </div>
      </BgBox>
    )
  }

  const comicData = (selectedComic?.data ?? {}) as ComicData
  const title = normalizeText(comicData.name) || selectedComicId
  const publisher = normalizeText((comicData as Record<string, unknown>).publisher)
  const status = normalizeText((comicData as Record<string, unknown>).status) || 'Unknown'
  const synopsis = normalizeText(comicData.synopsis)
  const coverUrl = selectedComic ? `${getApiBaseUrl()}/comics/${selectedComic.id}/cover` : undefined
  const showSelectionMode = isSelectionMode || hasSelectedChapters

  return (
    <BgBox className={cn('relative min-h-0 overflow-auto', className)} {...props}>
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-px">
        <MainContentHeader
          title={title}
          publisher={publisher}
          status={status}
          synopsis={synopsis}
          coverUrl={coverUrl}
        />
        <MainContentNav
          totalProgress={totalProgress}
          isSelectionMode={showSelectionMode}
          onToggleSelectionMode={() => {
            if (showSelectionMode) {
              setSelectedChapterIds(new Set())
              setIsSelectionMode(false)
              return
            }
            setIsSelectionMode(true)
          }}
          onRead={() => {
            if (!selectedComicId || !preferredReaderChapterId) return
            navigate(`/reader/${selectedComicId}/${preferredReaderChapterId}`)
          }}
          readDisabled={!preferredReaderChapterId}
        />
        <MainContentChapterTable
          comicId={selectedComicId}
          chapters={deferredChapters}
          progressByChapterId={readProgressByChapterId}
          selectedIds={selectedChapterIds}
          setSelectedIds={setSelectedChapterIds}
          isSelectionMode={showSelectionMode}
          onExitSelectionMode={() => setIsSelectionMode(false)}
          onOpenChapter={(chapterId) => navigate(`/reader/${selectedComicId}/${chapterId}`)}
        />
      </div>
    </BgBox>
  )
}
