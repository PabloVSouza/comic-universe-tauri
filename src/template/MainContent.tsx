import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'
import { Button } from 'components/ui/button'
import { useOpenWindow } from 'stores/window-manager'

export const MainContent: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  const openWindow = useOpenWindow()

  const openTestWindow = () => {
    openWindow({
      component: 'TestWindow'
    })
  }

  return (
    <BgBox className={cn('min-h-0 overflow-auto p-4', className)} {...props}>
      <div className="flex items-center gap-3">
        <p className="font-medium">MainContent</p>
        <Button onClick={openTestWindow}>Open test window</Button>
      </div>
    </BgBox>
  )
}
