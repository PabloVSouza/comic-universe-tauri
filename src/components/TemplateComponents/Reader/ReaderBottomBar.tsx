import { FC } from 'react'
import { Button } from 'components/ui/button'
import { useTranslation } from 'react-i18next'

interface ReaderBottomBarProps {
  chapterName: string
  currentPage: number
  totalPages: number
  onPreviousChapter: () => void
  onNextChapter: () => void
  hasPreviousChapter: boolean
  hasNextChapter: boolean
}

export const ReaderBottomBar: FC<ReaderBottomBarProps> = ({
  chapterName,
  currentPage,
  totalPages,
  onPreviousChapter,
  onNextChapter,
  hasPreviousChapter,
  hasNextChapter
}) => {
  const { t } = useTranslation()

  const progressPercentage = totalPages > 0 ? (currentPage / totalPages) * 100 : 0

  return (
    <div className="z-20 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-background px-3 backdrop-blur-sm">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 transition-colors hover:bg-accent/70"
        onClick={onPreviousChapter}
        disabled={!hasPreviousChapter}
      >
        {t('reader.previousChapter')}
      </Button>

      <div className="min-w-0">
        <p className="truncate text-center text-xs text-foreground/85">{chapterName}</p>
        <div className="relative mt-1 h-2 rounded-full bg-foreground/20">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-foreground/70 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[11px] text-foreground/75">
          {currentPage} / {totalPages}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 transition-colors hover:bg-accent/70"
          onClick={onNextChapter}
          disabled={!hasNextChapter}
        >
          {t('reader.nextChapter')}
        </Button>
      </div>
    </div>
  )
}
