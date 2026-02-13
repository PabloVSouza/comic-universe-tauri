import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'
import { Button } from 'components/ui/button'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useAppStore } from 'stores'
import { useClearAccountSessionMutation } from '../services'

export const MainContent: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  const openWindow = useOpenWindow()
  const logout = useAppStore((state) => state.logout)
  const clearAccountSession = useClearAccountSessionMutation()

  const openTestWindow = () => {
    openWindow({
      component: 'TestWindow'
    })
  }

  const handleLogoff = async () => {
    await clearAccountSession.mutateAsync()
    logout()
  }

  return (
    <BgBox className={cn('min-h-0 overflow-auto p-4', className)} {...props}>
      <div className="flex items-center gap-3">
        <p className="font-medium">MainContent</p>
        <Button onClick={openTestWindow}>Open test window</Button>
        <Button variant="outline" onClick={() => void handleLogoff()}>
          Logoff
        </Button>
      </div>
    </BgBox>
  )
}
