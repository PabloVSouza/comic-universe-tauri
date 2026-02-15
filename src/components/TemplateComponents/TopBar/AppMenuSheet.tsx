import { getCurrentWindow } from '@tauri-apps/api/window'
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from 'components/ui/sheet'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from 'stores'
import { AppMenuHeader } from './AppMenuHeader'
import { createMenuItems } from './AppMenuItems'
import { AppMenuRow } from './AppMenuRow'

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
          className="w-[252px] gap-px border-l border-border/60 bg-background/95 p-0 shadow-2xl shadow-black/40 supports-[backdrop-filter]:bg-background/82 supports-[backdrop-filter]:backdrop-blur-xl"
        >
          <AppMenuHeader
            profileName={profileName}
            profileEmail={profileEmail}
            avatarFallback={avatarFallback}
          />
          <SheetTitle className="sr-only">{t('topbar.menu.title')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('topbar.menu.openMenu')}
          </SheetDescription>

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
