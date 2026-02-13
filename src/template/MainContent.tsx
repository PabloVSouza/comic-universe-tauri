import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'
import { Button } from 'components/ui/button'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useAppStore } from 'stores'

export const MainContent: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  const openWindow = useOpenWindow()
  const account = useAppStore((state) => state.account)
  const logout = useAppStore((state) => state.logout)

  const openTestWindow = () => {
    openWindow({
      component: 'TestWindow'
    })
  }

  return (
    <BgBox className={cn('min-h-0 overflow-auto p-4', className)} {...props}>
      <div className="flex items-center gap-3">
        <p className="font-medium">MainContent</p>
        <p className="text-sm text-muted-foreground">
          Account: {account ? (account.displayName || account.username || account.email) : 'none'}
        </p>
        <Button onClick={openTestWindow}>Open test window</Button>
        <Button variant="outline" onClick={logout}>
          Logoff
        </Button>
      </div>
    </BgBox>
  )
}
