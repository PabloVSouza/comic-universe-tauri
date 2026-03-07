import { FC, ComponentProps, MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { BgBox } from 'components'
import { Button } from 'components/ui/button'
import { cn } from 'utils'
import { logoIcon } from 'assets'
import { PanelLeftOpen } from 'lucide-react'
import { useAppStore } from 'stores'
import { useTranslation } from 'react-i18next'
import { AppMenuSheet } from './index'

export const TopBar: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  const { t } = useTranslation()
  const setMobileListOpen = useAppStore((state) => state.setMobileListOpen)
  const { onOpenMobileList: _legacyOnOpenMobileList, ...domProps } = props as ComponentProps<'div'> & {
    onOpenMobileList?: unknown
  }

  const handleWindowDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    const noDragParent = target.closest('[data-no-window-drag]')
    if (noDragParent) return

    void getCurrentWindow().startDragging()
  }

  return (
    <BgBox
      onMouseDown={handleWindowDrag}
      className={cn(
        'relative isolate flex h-[calc(3.5rem+var(--cu-safe-top,0px))] px-3 select-none',
        className
      )}
      {...domProps}
    >
      <div data-tauri-drag-region className="absolute inset-0" />
      <div data-tauri-drag-region className="absolute inset-x-0 bottom-0 z-10 flex h-14 min-w-0 items-center gap-2 px-3" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute bottom-3 left-3 z-30 md:hidden hover:bg-white/10"
        aria-label={t('topbar.openList')}
        data-no-window-drag
        onClick={() => setMobileListOpen(true)}
      >
        <PanelLeftOpen className="size-4" />
      </Button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-14 items-center justify-center">
        <img src={logoIcon} alt="Comic Universe" className="h-8 w-auto object-contain" />
      </div>

      <AppMenuSheet />
    </BgBox>
  )
}
