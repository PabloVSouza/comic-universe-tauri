import { FC } from 'react'
import { Square, SquareCheck, ImagePlay } from 'lucide-react'
import { IconTooltipButton } from 'components'
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
        <IconTooltipButton
          label={
            isSelectionMode
              ? t('mainContent.chapterTable.mobile.doneSelection')
              : t('mainContent.chapterTable.mobile.selectChapters')
          }
          className="h-8 w-8 hover:bg-accent/70"
          onClick={onToggleSelectionMode}
          icon={isSelectionMode ? <SquareCheck className="size-4.5" /> : <Square className="size-4.5" />}
          iconClassName="size-5"
        />
      </div>
      <div className="flex items-center justify-center text-lg">{totalProgress}%</div>
      <div className="flex items-center justify-center">
        <IconTooltipButton
          label={t('mainContent.nav.actions.read')}
          className="h-8 w-8 hover:bg-accent/70"
          onClick={onRead}
          disabled={readDisabled}
          icon={<ImagePlay className="size-4" />}
        />
      </div>
    </div>
  )
}
