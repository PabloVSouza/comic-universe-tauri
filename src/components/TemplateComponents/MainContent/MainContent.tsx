import { ComponentProps, FC, useMemo } from 'react'
import { BgBox } from 'components'
import type { ChapterData, ComicData } from 'services'
import { getApiBaseUrl, useListChaptersByComicIdQuery, useListComicsQuery } from 'services'
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

const chapterProgress = (chapter: ChapterData): number => {
  const raw = chapter.progress
  if (typeof raw === 'number') return Math.max(0, Math.min(100, Math.round(raw)))
  return 0
}

export const MainContent: FC<MainContentProps> = ({ className, selectedComicId, ...props }) => {
  const comicsQuery = useListComicsQuery()
  const chaptersQuery = useListChaptersByComicIdQuery(selectedComicId)

  const selectedComic = useMemo(
    () => comicsQuery.data?.find((comic) => comic.id === selectedComicId) ?? null,
    [comicsQuery.data, selectedComicId]
  )

  const chapters = chaptersQuery.data ?? []
  const totalProgress = useMemo(() => {
    if (!chapters.length) return 0
    const total = chapters.reduce((sum, chapter) => sum + chapterProgress(chapter.data), 0)
    return Math.round(total / chapters.length)
  }, [chapters])

  if (!selectedComicId) {
    return (
      <BgBox className={cn('min-h-0 overflow-auto p-4', className)} {...props}>
        <div className="rounded-md border border-border/50 bg-background/70 p-3 text-sm text-muted-foreground">
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

  return (
    <BgBox className={cn('min-h-0 overflow-auto', className)} {...props}>
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-px">
        <MainContentHeader
          title={title}
          publisher={publisher}
          status={status}
          synopsis={synopsis}
          coverUrl={coverUrl}
        />
        <MainContentNav totalProgress={totalProgress} />
        <MainContentChapterTable comicId={selectedComicId} chapters={chapters} />
      </div>
    </BgBox>
  )
}
