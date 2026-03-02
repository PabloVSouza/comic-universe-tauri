import { ComponentProps, FC, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from 'i18n'
import { BgBox } from 'components'
import {
  type CanonicalChapterData,
  type ChapterMappingData,
  type ChapterVariantData,
  type WorkData,
  resolveChapterVariants,
  useDbFindQuery,
  useDbListQuery,
  useDbUpsertMutation
} from 'services'
import { cn } from 'utils'
import { MainContentHeader } from './MainContentHeader'
import { MainContentNav } from './MainContentNav'
import { MainContentChapterTable } from './MainContentChapterTable'

interface MainContentProps extends ComponentProps<'div'> {
  selectedWorkId?: string | null
}

const normalizeText = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length ? value : undefined
}

const AUTO_LANGUAGE_MODE = '__auto__'

const normalizeLanguageCode = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/_/g, '-')
}

const preferredAppLanguageCodes = (): string[] => {
  const resolved = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || 'en')
  const base = resolved.split('-')[0]
  const all = [resolved, base]

  if (base === 'pt') {
    all.push(resolved === 'pt-pt' ? 'pt-br' : 'pt-pt')
  }

  return Array.from(new Set(all.filter(Boolean)))
}

const preferredUiLanguageCodes = (): string[] => {
  return preferredAppLanguageCodes()
}

interface ReadProgressData {
  chapterId?: string
  comicId?: string
  page?: number
  totalPages?: number
  [key: string]: unknown
}

const chapterLanguageModeFromSettings = (work?: { data?: WorkData } | null): string => {
  const settings = work?.data?.settings as Record<string, unknown> | undefined
  const raw = typeof settings?.chapterLanguageMode === 'string' ? settings.chapterLanguageMode : ''
  if (raw.trim() === AUTO_LANGUAGE_MODE) return AUTO_LANGUAGE_MODE
  return normalizeLanguageCode(raw) || AUTO_LANGUAGE_MODE
}

const progressPercentFromReadProgress = (readProgress?: ReadProgressData): number => {
  if (!readProgress) return 0
  const totalPages = typeof readProgress.totalPages === 'number' ? readProgress.totalPages : 0
  const page = typeof readProgress.page === 'number' ? readProgress.page : 0
  if (totalPages <= 0) return 0
  const safePage = Math.max(0, Math.min(page, totalPages))
  return Math.max(0, Math.min(100, Math.round((safePage / totalPages) * 100)))
}

export const MainContent: FC<MainContentProps> = ({
  className,
  selectedWorkId,
  ...props
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const worksQuery = useDbListQuery<WorkData>('works', 500, 0)
  const upsertWorkMutation = useDbUpsertMutation<WorkData>()
  const canonicalChaptersQuery = useDbFindQuery<CanonicalChapterData>(
    'canonical_chapters',
    'workId',
    selectedWorkId ?? '',
    5000,
    Boolean(selectedWorkId)
  )
  const chapterVariantsQuery = useDbFindQuery<ChapterVariantData>(
    'chapter_variants',
    'workId',
    selectedWorkId ?? '',
    5000,
    Boolean(selectedWorkId)
  )
  const chapterMappingsQuery = useDbFindQuery<ChapterMappingData>(
    'chapter_mappings',
    'workId',
    selectedWorkId ?? '',
    5000,
    Boolean(selectedWorkId)
  )
  const readProgressQuery = useDbFindQuery<ReadProgressData>(
    'read_progress',
    'comicId',
    selectedWorkId ?? '',
    5000,
    Boolean(selectedWorkId)
  )
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedChapterLanguage, setSelectedChapterLanguage] = useState<string>(AUTO_LANGUAGE_MODE)

  const selectedWork = useMemo(
    () => worksQuery.data?.find((work) => work.id === selectedWorkId) ?? null,
    [worksQuery.data, selectedWorkId]
  )

  const availableChapterLanguages = useMemo(() => {
    const languages = new Set<string>()
    for (const variant of chapterVariantsQuery.data ?? []) {
      const raw = Array.isArray(variant.data.languageCodes) ? variant.data.languageCodes : []
      for (const entry of raw) {
        const normalized = normalizeLanguageCode(entry)
        if (normalized) languages.add(normalized)
      }
      const direct = normalizeLanguageCode(variant.data.language)
      if (direct) languages.add(direct)
    }
    return [...languages].sort((left, right) => left.localeCompare(right))
  }, [chapterVariantsQuery.data])

  useEffect(() => {
    const savedMode = chapterLanguageModeFromSettings(selectedWork)
    const savedLanguageAvailable =
      savedMode === AUTO_LANGUAGE_MODE || availableChapterLanguages.includes(savedMode)

    if (availableChapterLanguages.length <= 1) {
      const onlyLanguage = availableChapterLanguages[0]
      if (onlyLanguage) {
        setSelectedChapterLanguage(savedLanguageAvailable && savedMode !== AUTO_LANGUAGE_MODE ? savedMode : onlyLanguage)
        return
      }

      setSelectedChapterLanguage(AUTO_LANGUAGE_MODE)
      return
    }

    setSelectedChapterLanguage(() => {
      if (savedLanguageAvailable) {
        return savedMode
      }
      return AUTO_LANGUAGE_MODE
    })
  }, [availableChapterLanguages, selectedWork, selectedWorkId])

  const handleSelectChapterLanguage = (nextLanguage: string) => {
    setSelectedChapterLanguage(nextLanguage)

    if (!selectedWork) return

    const savedMode = chapterLanguageModeFromSettings(selectedWork)
    const nextMode =
      nextLanguage && nextLanguage !== AUTO_LANGUAGE_MODE
        ? normalizeLanguageCode(nextLanguage)
        : AUTO_LANGUAGE_MODE

    if (savedMode === nextMode) return

    void upsertWorkMutation
      .mutateAsync({
        table: 'works',
        id: selectedWork.id,
        data: {
          ...(selectedWork.data as WorkData),
          settings: {
            ...(selectedWork.data.settings as Record<string, unknown> | undefined),
            chapterLanguageMode: nextMode
          }
        }
      })
      .then(() => {
        void worksQuery.refetch()
      })
  }

  const chapterLanguagePriority = useMemo(() => {
    if (selectedChapterLanguage !== AUTO_LANGUAGE_MODE) {
      return selectedChapterLanguage ? [selectedChapterLanguage] : []
    }

    const appPreferred = preferredUiLanguageCodes()
    const englishPreferred = ['en']
    const remaining = availableChapterLanguages.filter((language) => {
      const normalized = normalizeLanguageCode(language)
      return !appPreferred.includes(normalized) && normalized !== 'en'
    })

    return Array.from(new Set([...appPreferred, ...englishPreferred, ...remaining]))
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
      chapterLanguagePriority,
      chapterMappingsQuery.data,
      chapterVariantsQuery.data,
      strictLanguageFilter
    ]
  )
  const chapterCountHint = useMemo(() => {
    const raw = selectedWork?.data?.chapterCount
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0
  }, [selectedWork?.data?.chapterCount])

  const chaptersWithFallback = useMemo(() => {
    const hasImportedVariants = (chapterVariantsQuery.data?.length ?? 0) > 0
    if (chapters.length > 0 || !selectedWorkId || chapterCountHint <= 0 || hasImportedVariants) return chapters

    return Array.from({ length: chapterCountHint }, (_, index) => {
      const number = String(index + 1)
      return {
        id: `placeholder:${selectedWorkId}:${number}`,
        created_at: '',
        updated_at: '',
        data: {
          canonicalChapterId: `placeholder:${selectedWorkId}:${number}`,
          number,
          name: t('common.chapterLabel', { number }),
          pages: [],
          isPlaceholder: true
        }
      }
    })
  }, [chapterCountHint, chapterVariantsQuery.data?.length, chapters, selectedWorkId, t])
  const deferredChapters = useDeferredValue(chaptersWithFallback)
  const hasSelectedChapters = selectedChapterIds.size > 0

  const readProgressByChapterId = useMemo(() => {
    const map = new Map<string, number>()
    for (const record of readProgressQuery.data ?? []) {
      const chapterId = typeof record.data.chapterId === 'string' ? record.data.chapterId : undefined
      if (!chapterId) continue
      map.set(chapterId, progressPercentFromReadProgress(record.data))
    }
    return map
  }, [readProgressQuery.data])

  const progressForChapter = useMemo(
    () => (chapter: (typeof deferredChapters)[number]): number => {
      const chapterData = chapter.data as Record<string, unknown>
      const variantChapterId =
        typeof chapterData.variantChapterId === 'string' ? chapterData.variantChapterId : ''
      return (
        readProgressByChapterId.get(chapter.id) ??
        (variantChapterId ? readProgressByChapterId.get(variantChapterId) : undefined) ??
        0
      )
    },
    [readProgressByChapterId]
  )

  const preferredReaderChapterId = useMemo(() => {
    const lastChapterWithProgress = [...deferredChapters]
      .reverse()
      .find((chapter) => progressForChapter(chapter) > 0)

    return lastChapterWithProgress?.id ?? deferredChapters[0]?.id ?? null
  }, [deferredChapters, progressForChapter])

  const totalProgress = useMemo(() => {
    if (!deferredChapters.length) return 0
    const total = deferredChapters.reduce(
      (sum, chapter) => sum + progressForChapter(chapter),
      0
    )
    return Math.round(total / deferredChapters.length)
  }, [deferredChapters, progressForChapter])

  useEffect(() => {
    setSelectedChapterIds(new Set())
    setIsSelectionMode(false)
  }, [selectedWorkId])

  if (!selectedWorkId) {
    return (
      <BgBox className={cn('relative min-h-0 overflow-auto p-4', className)} {...props}>
        <div className="rounded-md border border-border/50 bg-background p-3 text-sm text-muted-foreground">
          {t('mainContent.emptySelection')}
        </div>
      </BgBox>
    )
  }

  const workData = (selectedWork?.data ?? {}) as WorkData
  const title = normalizeText(workData.title) || normalizeText(workData.name) || selectedWorkId
  const publisher = normalizeText(workData.publisher)
  const status = normalizeText(workData.status) || t('mainContent.unknownStatus')
  const synopsis = normalizeText(workData.description) || normalizeText(workData.synopsis)
  const coverUrl = normalizeText(workData.cover)
  const showSelectionMode = isSelectionMode || hasSelectedChapters

  return (
    <BgBox className={cn('relative min-h-0 overflow-hidden', className)} {...props}>
      <div
        className="grid h-full min-h-0 gap-px overflow-hidden"
        style={{ gridTemplateRows: '18rem 3rem minmax(0, 1fr)' }}
      >
        <MainContentHeader
          title={title}
          publisher={publisher}
          status={status}
          synopsis={synopsis}
          coverUrl={coverUrl}
        />
        <MainContentNav
          totalProgress={totalProgress}
          availableChapterLanguages={availableChapterLanguages}
          selectedChapterLanguage={selectedChapterLanguage}
          autoLanguageMode={AUTO_LANGUAGE_MODE}
          onSelectChapterLanguage={handleSelectChapterLanguage}
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
            if (!selectedWorkId || !preferredReaderChapterId) return
            navigate(`/reader/${selectedWorkId}/${preferredReaderChapterId}`)
          }}
          readDisabled={!preferredReaderChapterId}
        />
        <MainContentChapterTable
          entityId={selectedWorkId}
          chapters={deferredChapters}
          progressByChapterId={readProgressByChapterId}
          selectedIds={selectedChapterIds}
          setSelectedIds={setSelectedChapterIds}
          isSelectionMode={showSelectionMode}
          onExitSelectionMode={() => setIsSelectionMode(false)}
          onOpenChapter={(chapterId) => navigate(`/reader/${selectedWorkId}/${chapterId}`)}
        />
      </div>
    </BgBox>
  )
}
