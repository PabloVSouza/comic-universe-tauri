import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from 'components/ui/sheet'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAppStore } from 'stores'
import { AppMenuRow } from './AppMenuRow'
import { AppMenuHeader } from './AppMenuHeader'
import { createMenuItems } from './AppMenuItems'

export const AppMenuSheet: FC = () => {
  const { t } = useTranslation()
  const account = useAppStore((state) => state.account)

  const profileName =
    account?.displayName || account?.username || account?.email || t('topbar.menu.user.guest')
  const profileEmail = account?.email || t('topbar.menu.user.notSignedIn')
  const avatarFallback =
    profileName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'

  const handleCloseApp = async () => {
    try {
      await getCurrentWindow().close()
    } catch (error) {
      console.error('[AppMenuSheet] Failed to close current window', error)
    }
  }

  const menuItems = createMenuItems(() => void handleCloseApp())

  return (
    <div data-no-window-drag className="absolute right-3 z-30">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="rounded-full ring-0 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={t('topbar.menu.openMenu')}
          >
            <Avatar className="size-8 border border-white/25 bg-white/15">
              <AvatarImage src={undefined} alt={profileName} />
              <AvatarFallback className="bg-white/20 text-xs font-semibold text-white">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </button>
        </SheetTrigger>

        <SheetContent
          side="right"
          showCloseButton={false}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[252px] gap-0 border-l border-black/10 bg-[#dbd9de]/88 p-0 backdrop-blur-xl"
        >
          <AppMenuHeader
            profileName={profileName}
            profileEmail={profileEmail}
            avatarFallback={avatarFallback}
          />
          <SheetTitle className="sr-only">{t('topbar.menu.title')}</SheetTitle>

          <div className="py-0.5">
            {menuItems.map((item) => (
              <AppMenuRow
                key={item.labelKey}
                icon={item.icon}
                label={t(item.labelKey)}
                onClick={item.onClick}
                withBorder={item.withBorder}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
