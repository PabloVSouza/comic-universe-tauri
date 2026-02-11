import type { CSSProperties, ReactNode } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { cn } from 'utils'
import { Button } from 'components/ui/button'
import type { WindowInstance } from 'providers/WindowProvider'
import { useWindowManager } from 'providers/WindowProvider'

type WindowProps = {
  window: WindowInstance
  children?: ReactNode
}

export function Window({ window, children }: WindowProps) {
  const {
    closeWindow,
    focusWindow,
    setWindowMoving,
    setWindowResizing,
    setWindowMaximized,
    setWindowMinimized
  } = useWindowManager()

  const {
    id,
    title,
    closeable,
    maximizable,
    minimizable,
    resizable,
    movable,
    titleBar,
    className,
    contentClassName,
    windowStatus
  } = window

  const zIndex = windowStatus.isFocused ? 60 : 50

  const style: CSSProperties = windowStatus.isMaximized
    ? {
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex
      }
    : {
        top: `${windowStatus.top}px`,
        left: `${windowStatus.left}px`,
        width: `${windowStatus.width}px`,
        height: `${windowStatus.height}px`,
        zIndex
      }

  return (
    <section
      className={cn(
        'pointer-events-auto absolute flex min-h-40 min-w-56 flex-col overflow-hidden rounded-lg border border-border/70 bg-card/95 text-card-foreground shadow-xl backdrop-blur-sm',
        className
      )}
      style={style}
      onMouseDown={() => focusWindow(id)}
    >
      {titleBar && (
        <header
          className={cn(
            'relative flex h-10 shrink-0 items-center border-b border-border/70 bg-muted/70 px-2',
            movable && 'cursor-grab',
            movable && windowStatus.isMoving && 'cursor-grabbing'
          )}
          onMouseDown={(event) => {
            if (!movable || event.button !== 0) {
              return
            }

            setWindowMoving(id, true)
          }}
          onDoubleClick={() => {
            if (!maximizable) {
              return
            }

            setWindowMaximized(id, !windowStatus.isMaximized)
          }}
        >
          <p className="truncate px-2 text-sm font-medium">{title || id}</p>

          <div className="ml-auto flex items-center gap-1">
            {minimizable && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setWindowMinimized(id, true)}
              >
                <Minus className="size-4" />
              </Button>
            )}

            {maximizable && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setWindowMaximized(id, !windowStatus.isMaximized)}
              >
                <Square className="size-3.5" />
              </Button>
            )}

            {closeable && (
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => closeWindow(id)}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </header>
      )}

      {!titleBar && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {minimizable && (
            <Button
              size="icon-xs"
              variant="secondary"
              className="h-7 w-7"
              onClick={() => setWindowMinimized(id, true)}
            >
              <Minus className="size-4" />
            </Button>
          )}

          {closeable && (
            <Button
              size="icon-xs"
              variant="destructive"
              className="h-7 w-7"
              onClick={() => closeWindow(id)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      )}

      <div className={cn('min-h-0 flex-1 overflow-auto', contentClassName)}>{children}</div>

      {resizable && !windowStatus.isMaximized && (
        <button
          type="button"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-gradient-to-tl from-border/90 to-transparent"
          onMouseDown={(event) => {
            if (event.button !== 0) {
              return
            }

            setWindowResizing(id, true)
          }}
          aria-label="Resize window"
        />
      )}
    </section>
  )
}
