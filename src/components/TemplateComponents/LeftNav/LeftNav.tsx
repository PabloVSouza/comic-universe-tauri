import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { BgBox } from 'components'
import { Button } from 'components/ui/button'
import { Search } from 'lucide-react'
import { ComponentProps, FC } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'utils'

interface LeftNavProps extends ComponentProps<'div'> {}

export const LeftNav: FC<LeftNavProps> = ({ className, ...props }) => {
  const { t } = useTranslation()
  const openWindow = useOpenWindow()

  return (
    <BgBox
      className={cn('flex h-14 items-center justify-between px-3 sm:px-4', className)}
      {...props}
    >
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full justify-start gap-2 rounded-sm bg-background px-2 text-sm text-muted-foreground hover:bg-accent/50"
        onClick={() => openWindow({ component: 'SearchContentWindow' })}
      >
        <Search className="size-4" />
        {t('leftNav.library')}
      </Button>
    </BgBox>
  )
}
