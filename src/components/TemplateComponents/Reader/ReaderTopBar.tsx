import { FC } from 'react'
import { ArrowRight, BookOpen, BookOpenCheck, Columns2, Rows3, X } from 'lucide-react'
import { IconTooltipButton } from 'components'
import { useTranslation } from 'react-i18next'

interface ReaderTopBarProps {
  comicName: string
  chapterName: string
  readingMode: 'horizontal' | 'vertical'
  readingDirection: 'ltr' | 'rtl'
  doublePageSpread: boolean
  disableDoublePageSpread?: boolean
  onSetReadingMode: (vertical: boolean) => void
  onSetReadingDirection: (rtl: boolean) => void
  onSetDoublePageSpread: (enabled: boolean) => void
  onClose: () => void
}

export const ReaderTopBar: FC<ReaderTopBarProps> = ({
  comicName,
  chapterName,
  readingMode,
  readingDirection,
  doublePageSpread,
  disableDoublePageSpread = false,
  onSetReadingMode,
  onSetReadingDirection,
  onSetDoublePageSpread,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <div className="relative z-20 h-[calc(3rem+var(--cu-safe-top,0px))] bg-background backdrop-blur-sm">
      <div className="absolute inset-x-0 bottom-0 flex h-12 items-center gap-2 px-3 sm:justify-end">
        <div className="min-w-0 flex-1 pr-1 sm:hidden">
          <p className="truncate text-left text-sm">{comicName}</p>
          <p className="truncate text-left text-xs text-foreground/70">{chapterName}</p>
        </div>

        <div className="z-20 flex shrink-0 items-center gap-2">
          <IconTooltipButton
            label={t('reader.verticalReading')}
            onClick={() => onSetReadingMode(readingMode !== 'vertical')}
            icon={readingMode === 'vertical' ? <Rows3 className="size-4" /> : <Columns2 className="size-4" />}
          />

          <IconTooltipButton
            label={t('reader.rightToLeft')}
            onClick={() => onSetReadingDirection(readingDirection !== 'rtl')}
            icon={
              <ArrowRight
                className={`size-4 transition-transform ${readingDirection === 'rtl' ? 'rotate-180' : ''}`}
              />
            }
          />

          <IconTooltipButton
            label={t('reader.doublePageSpread')}
            onClick={() => onSetDoublePageSpread(!doublePageSpread)}
            disabled={readingMode !== 'horizontal' || disableDoublePageSpread}
            icon={doublePageSpread ? <BookOpenCheck className="size-4" /> : <BookOpen className="size-4" />}
          />

          <IconTooltipButton
            label={t('reader.close')}
            onClick={onClose}
            className="h-8 w-8 rounded-full transition-colors hover:bg-accent/70"
            icon={<X className="size-4" />}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-12 items-center justify-center px-20 sm:flex">
        <div className="min-w-0 text-center">
          <p className="truncate text-sm">{comicName}</p>
          <p className="truncate text-xs text-foreground/70">{chapterName}</p>
        </div>
      </div>
    </div>
  )
}
