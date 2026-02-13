import { FC, ComponentProps, MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { BgBox } from 'components'
import { cn } from 'utils'
import { logoIcon } from 'assets'
import { AppMenuSheet } from './index'

export const TopBar: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
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
      className={cn('relative flex h-14 items-center px-3 select-none', className)}
      {...props}
    >
      <div data-tauri-drag-region className="absolute inset-0" />
      <div data-tauri-drag-region className="z-10 flex min-w-0 flex-1 items-center gap-2" />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <img src={logoIcon} alt="Comic Universe" className="h-8 w-auto object-contain" />
      </div>

      <AppMenuSheet />
    </BgBox>
  )
}
