import { FC } from 'react'
import { ArrowRight, BookOpen, BookOpenCheck, Columns2, Rows3, X } from 'lucide-react'
import { Button } from 'components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
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
    <div className="relative z-20 flex h-12 items-center justify-end bg-background px-3 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-20">
        <div className="min-w-0 text-center">
          <p className="truncate text-sm">{comicName}</p>
          <p className="truncate text-xs text-foreground/70">{chapterName}</p>
        </div>
      </div>

      <div className="z-20 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 transition-colors hover:bg-accent/70"
              aria-label={t('reader.verticalReading')}
              onClick={() => onSetReadingMode(readingMode !== 'vertical')}
            >
              {readingMode === 'vertical' ? (
                <Rows3 className="size-4" />
              ) : (
                <Columns2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('reader.verticalReading')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 transition-colors hover:bg-accent/70"
              aria-label={t('reader.rightToLeft')}
              onClick={() => onSetReadingDirection(readingDirection !== 'rtl')}
            >
              <ArrowRight className={`size-4 transition-transform ${readingDirection === 'rtl' ? 'rotate-180' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('reader.rightToLeft')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 transition-colors hover:bg-accent/70"
              aria-label={t('reader.doublePageSpread')}
              onClick={() => onSetDoublePageSpread(!doublePageSpread)}
              disabled={readingMode !== 'horizontal' || disableDoublePageSpread}
            >
              {doublePageSpread ? <BookOpenCheck className="size-4" /> : <BookOpen className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('reader.doublePageSpread')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 rounded-full transition-colors hover:bg-accent/70"
              onClick={onClose}
              aria-label={t('reader.close')}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('reader.close')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
