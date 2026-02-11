import { useEffect, useRef } from 'react'
import { InPortal, OutPortal } from 'react-reverse-portal'
import { useWindowManager } from 'providers/WindowProvider'
import { Window } from './Window'
import { MinimizedBar } from './MinimizedBar'

export function WindowManager() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { windows, setContainerSize, mouseCapture, removeMovingResizing } = useWindowManager()

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    window.addEventListener('resize', updateSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [setContainerSize])

  const activeWindows = windows.filter((window) => !window.windowStatus.isMinimized)
  const minimizedWindows = windows.filter((window) => window.windowStatus.isMinimized)

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      onMouseMoveCapture={mouseCapture}
      onMouseUp={removeMovingResizing}
      onMouseLeave={removeMovingResizing}
    >
      {windows.map((window) => (
        <InPortal key={`portal-${window.id}`} node={window.portalNode}>
          {window.content}
        </InPortal>
      ))}

      {activeWindows.map((window) => (
        <Window key={window.id} window={window}>
          <OutPortal node={window.portalNode} />
        </Window>
      ))}

      {!!minimizedWindows.length && <MinimizedBar windows={minimizedWindows} />}
    </div>
  )
}
