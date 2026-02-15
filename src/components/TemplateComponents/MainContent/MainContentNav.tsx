import { FC } from 'react'
import { Square, SquareCheck, ImagePlay } from 'lucide-react'
import { Button } from 'components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { useTranslation } from 'react-i18next'

interface MainContentNavProps {
  totalProgress: number
  isSelectionMode: boolean
  onToggleSelectionMode: () => void
  onRead: () => void
  readDisabled?: boolean
}

export const MainContentNav: FC<MainContentNavProps> = ({
  totalProgress,
  isSelectionMode,
  onToggleSelectionMode,
  onRead,
  readDisabled
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex h-12 justify-between w-full bg-background p-2">
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 hover:bg-accent/70"
              aria-label={
                isSelectionMode
                  ? t('mainContent.chapterTable.mobile.doneSelection')
                  : t('mainContent.chapterTable.mobile.selectChapters')
              }
              onClick={onToggleSelectionMode}
            >
              <span className="inline-flex size-5 items-center justify-center">
                {isSelectionMode ? (
                  <SquareCheck className="size-4.5" />
                ) : (
                  <Square className="size-4.5" />
                )}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSelectionMode
              ? t('mainContent.chapterTable.mobile.doneSelection')
              : t('mainContent.chapterTable.mobile.selectChapters')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center justify-center text-lg">{totalProgress}%</div>
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 hover:bg-accent/70"
              aria-label={t('mainContent.nav.actions.read')}
              onClick={onRead}
              disabled={readDisabled}
            >
              <ImagePlay className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('mainContent.nav.actions.read')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
