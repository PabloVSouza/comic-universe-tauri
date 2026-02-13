import { FC } from 'react'
import { Download } from 'lucide-react'
import { Button } from 'components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { useTranslation } from 'react-i18next'

interface MainContentNavProps {
  totalProgress: number
}

export const MainContentNav: FC<MainContentNavProps> = ({ totalProgress }) => {
  const { t } = useTranslation()

  return (
    <div className="grid h-12 grid-cols-[3.5rem_minmax(0,1fr)] gap-px bg-border/40">
      <div className="flex items-center justify-center bg-background/80">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 hover:bg-accent/70"
              aria-label={t('mainContent.nav.actions.download')}
            >
              <Download className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('mainContent.nav.actions.download')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center justify-center bg-background/80 text-lg">{totalProgress}%</div>
    </div>
  )
}
