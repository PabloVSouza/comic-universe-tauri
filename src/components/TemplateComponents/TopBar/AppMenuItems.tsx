import { ReactNode } from 'react'
import { Info, Puzzle, Power, Settings2, UserRound } from 'lucide-react'

export interface AppMenuItem {
  icon: ReactNode
  labelKey: string
  withBorder?: boolean
  onClick?: () => void
}

export const createMenuItems = (onCloseApp: () => void): AppMenuItem[] => [
  {
    icon: <Info className="size-5 min-w-5" />,
    labelKey: 'topbar.menu.aboutApp'
  },
  {
    icon: <Settings2 className="size-5 min-w-5" />,
    labelKey: 'topbar.menu.settings'
  },
  {
    icon: <UserRound className="size-5 min-w-5" />,
    labelKey: 'topbar.menu.userSettings'
  },
  {
    icon: <Puzzle className="size-5 min-w-5" />,
    labelKey: 'topbar.menu.plugins'
  },
  {
    icon: <Power className="size-5 min-w-5" />,
    labelKey: 'topbar.menu.closeApp',
    withBorder: false,
    onClick: onCloseApp
  }
]
