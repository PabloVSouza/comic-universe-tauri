import { BgBox } from 'components'
import { Button } from 'components/ui/button'
import { PanelLeftOpen } from 'lucide-react'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'

interface LeftNavProps extends ComponentProps<'div'> {
  onOpenMobileList?: () => void
}

export const LeftNav: FC<LeftNavProps> = ({ className, onOpenMobileList, ...props }) => {
  return (
    <BgBox
      className={cn('flex h-14 items-center justify-between px-3 sm:px-4', className)}
      {...props}
    >
      <p className="text-sm text-muted-foreground">Library</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="md:hidden hover:bg-white/10"
        aria-label="Open list"
        onClick={onOpenMobileList}
      >
        <PanelLeftOpen className="size-4" />
      </Button>
    </BgBox>
  )
}
