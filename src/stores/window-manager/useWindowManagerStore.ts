import { createHtmlPortalNode } from 'react-reverse-portal'
import { create } from 'zustand'
import type {
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore,
  WindowMeasure,
  WindowStartPosition
} from './types'

const defaultContainerSize = { width: 0, height: 0 }
const defaultInitialStatus: WindowInitialStatus & { startPosition: WindowStartPosition } = {
  isMaximized: false,
  isMinimized: false,
  isFocused: true,
  width: 720,
  height: 480,
  startPosition: 'center'
}

const MIN_WINDOW_WIDTH = 320
const MIN_WINDOW_HEIGHT = 220

const parseMeasure = (value: WindowMeasure | undefined, container: number, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (trimmed.endsWith('%')) {
      const percent = Number.parseFloat(trimmed.slice(0, -1))
      if (Number.isFinite(percent)) {
        return (container * percent) / 100
      }
    }

    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const resolvePositionByStart = (
  startPosition: WindowStartPosition,
  width: number,
  height: number,
  container: { width: number; height: number }
): { left: number; top: number } => {
  const positions: Record<WindowStartPosition, { left: number; top: number }> = {
    topLeft: { left: 0, top: 0 },
    topCenter: { left: (container.width - width) / 2, top: 0 },
    topRight: { left: container.width - width, top: 0 },
    centerLeft: { left: 0, top: (container.height - height) / 2 },
    center: { left: (container.width - width) / 2, top: (container.height - height) / 2 },
    centerRight: { left: container.width - width, top: (container.height - height) / 2 },
    bottomLeft: { left: 0, top: container.height - height },
    bottomCenter: { left: (container.width - width) / 2, top: container.height - height },
    bottomRight: { left: container.width - width, top: container.height - height }
  }

  return positions[startPosition]
}

const focusWindowInList = (windows: WindowInstance[], id: string): WindowInstance[] => {
  return windows.map((window) => ({
    ...window,
    windowStatus: {
      ...window.windowStatus,
      isFocused: window.id === id
    }
  }))
}

let idCounter = 0

export const useWindowManagerStore = create<WindowManagerStore>((set, get) => ({
  windows: [],
  containerSize: defaultContainerSize,

  setContainerSize: (size) => {
    set((state) => {
      if (!size.width || !size.height) {
        return { ...state, containerSize: size }
      }

      const nextWindows = state.windows.map((window) => {
        if (window.windowStatus.isMaximized) {
          return {
            ...window,
            windowStatus: {
              ...window.windowStatus,
              top: 0,
              left: 0,
              width: size.width,
              height: size.height
            },
            originalContainerSize: size
          }
        }

        const { width, height, left, top } = window.windowStatus
        const outOfBounds =
          left < 0 || top < 0 || left + width > size.width || top + height > size.height

        if (!outOfBounds) {
          return {
            ...window,
            originalContainerSize: size
          }
        }

        let nextLeft = left
        let nextTop = top

        if (
          window.originalContainerSize &&
          window.originalContainerSize.width &&
          window.originalContainerSize.height
        ) {
          const widthRatio = size.width / window.originalContainerSize.width
          const heightRatio = size.height / window.originalContainerSize.height
          nextLeft = left * widthRatio
          nextTop = top * heightRatio
        } else {
          const startPos = resolvePositionByStart(
            window.initialStatus.startPosition || 'center',
            width,
            height,
            size
          )
          const initialLeft =
            window.initialStatus.left !== undefined
              ? parseMeasure(window.initialStatus.left, size.width, startPos.left)
              : startPos.left
          const initialTop =
            window.initialStatus.top !== undefined
              ? parseMeasure(window.initialStatus.top, size.height, startPos.top)
              : startPos.top
          nextLeft = initialLeft
          nextTop = initialTop
        }

        nextLeft = clamp(nextLeft, 0, Math.max(0, size.width - width))
        nextTop = clamp(nextTop, 0, Math.max(0, size.height - height))

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            left: nextLeft,
            top: nextTop
          },
          originalContainerSize: size
        }
      })

      return {
        ...state,
        containerSize: size,
        windows: nextWindows
      }
    })
  },

  focusWindow: (id) => {
    set((state) => ({
      ...state,
      windows: focusWindowInList(state.windows, id)
    }))
  },

  closeWindow: (id) => {
    set((state) => {
      const filtered = state.windows.filter((window) => window.id !== id)

      if (!filtered.length) {
        return { ...state, windows: filtered }
      }

      if (filtered.some((window) => window.windowStatus.isFocused)) {
        return { ...state, windows: filtered }
      }

      const lastWindow = filtered[filtered.length - 1]
      return {
        ...state,
        windows: focusWindowInList(filtered, lastWindow.id)
      }
    })
  },

  setWindowMoving: (id, moving) => {
    set((state) => ({
      ...state,
      windows: state.windows.map((window) => {
        if (window.id !== id || window.windowStatus.isMaximized || !window.movable) {
          return window
        }

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            isMoving: moving
          }
        }
      })
    }))
  },

  setWindowResizing: (id, resizing) => {
    set((state) => ({
      ...state,
      windows: state.windows.map((window) => {
        if (window.id !== id || window.windowStatus.isMaximized || !window.resizable) {
          return window
        }

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            isResizing: resizing
          }
        }
      })
    }))
  },

  setWindowMinimized: (id, minimized) => {
    set((state) => {
      const updated = state.windows.map((window) => {
        if (window.id !== id) {
          return window
        }

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            isMinimized: minimized,
            isMoving: false,
            isResizing: false,
            isFocused: !minimized
          }
        }
      })

      return {
        ...state,
        windows: minimized ? updated : focusWindowInList(updated, id)
      }
    })
  },

  setWindowMaximized: (id, maximized) => {
    const { containerSize } = get()

    set((state) => ({
      ...state,
      windows: state.windows.map((window) => {
        if (window.id !== id || !window.maximizable) {
          return window
        }

        if (maximized) {
          return {
            ...window,
            restoreStatus: {
              width: window.windowStatus.width,
              height: window.windowStatus.height,
              left: window.windowStatus.left,
              top: window.windowStatus.top
            },
            windowStatus: {
              ...window.windowStatus,
              isMaximized: true,
              isMoving: false,
              isResizing: false,
              left: 0,
              top: 0,
              width: containerSize.width || window.windowStatus.width,
              height: containerSize.height || window.windowStatus.height
            }
          }
        }

        if (!window.restoreStatus) {
          return {
            ...window,
            windowStatus: {
              ...window.windowStatus,
              isMaximized: false
            }
          }
        }

        return {
          ...window,
          windowStatus: {
            ...window.windowStatus,
            ...window.restoreStatus,
            isMaximized: false,
            isMoving: false,
            isResizing: false
          }
        }
      })
    }))
  },

  updateWindow: (id, patch) => {
    set((state) => ({
      ...state,
      windows: state.windows.map((window) => {
        if (window.id !== id) {
          return window
        }

        return {
          ...window,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.className !== undefined ? { className: patch.className } : {}),
          ...(patch.contentClassName !== undefined
            ? { contentClassName: patch.contentClassName }
            : {}),
          ...(patch.closeable !== undefined ? { closeable: patch.closeable } : {}),
          ...(patch.maximizable !== undefined ? { maximizable: patch.maximizable } : {}),
          ...(patch.minimizable !== undefined ? { minimizable: patch.minimizable } : {}),
          ...(patch.resizable !== undefined ? { resizable: patch.resizable } : {}),
          ...(patch.movable !== undefined ? { movable: patch.movable } : {}),
          ...(patch.titleBar !== undefined ? { titleBar: patch.titleBar } : {})
        }
      })
    }))
  },

  openWindow: (params) => {
    idCounter += 1
    const generatedId = `window-${idCounter}`
    const id = params.id || generatedId

    set((state) => {
      const existing = state.windows.find((window) => window.id === id)

      if (params.unique && existing) {
        return {
          ...state,
          windows: state.windows.map((window) => {
            if (window.id !== id) {
              return {
                ...window,
                windowStatus: {
                  ...window.windowStatus,
                  isFocused: false
                }
              }
            }

            return {
              ...window,
              title: params.title ?? window.title,
              content: params.content,
              closeable: params.closeable ?? window.closeable,
              className: params.className ?? window.className,
              contentClassName: params.contentClassName ?? window.contentClassName,
              maximizable: params.maximizable ?? window.maximizable,
              minimizable: params.minimizable ?? window.minimizable,
              resizable: params.resizable ?? window.resizable,
              movable: params.movable ?? window.movable,
              titleBar: params.titleBar ?? window.titleBar,
              windowStatus: {
                ...window.windowStatus,
                isFocused: true,
                isMinimized: false
              }
            }
          })
        }
      }

      const initialStatus = {
        ...defaultInitialStatus,
        ...(params.initialStatus || {})
      }

      const width = clamp(
        parseMeasure(initialStatus.width, state.containerSize.width, 720),
        MIN_WINDOW_WIDTH,
        Math.max(MIN_WINDOW_WIDTH, state.containerSize.width || 720)
      )
      const height = clamp(
        parseMeasure(initialStatus.height, state.containerSize.height, 480),
        MIN_WINDOW_HEIGHT,
        Math.max(MIN_WINDOW_HEIGHT, state.containerSize.height || 480)
      )

      const startPosition = initialStatus.startPosition || 'center'
      const startPos = resolvePositionByStart(startPosition, width, height, state.containerSize)

      const left = clamp(
        initialStatus.left !== undefined
          ? parseMeasure(initialStatus.left, state.containerSize.width, startPos.left)
          : startPos.left,
        0,
        Math.max(0, state.containerSize.width - width)
      )

      const top = clamp(
        initialStatus.top !== undefined
          ? parseMeasure(initialStatus.top, state.containerSize.height, startPos.top)
          : startPos.top,
        0,
        Math.max(0, state.containerSize.height - height)
      )

      const nextWindow: WindowInstance = {
        id,
        title: params.title,
        content: params.content,
        portalNode: createHtmlPortalNode({
          attributes: {
            class: params.contentClassName ?? ''
          }
        }),
        closeable: params.closeable ?? true,
        className: params.className,
        contentClassName: params.contentClassName,
        maximizable: params.maximizable ?? true,
        minimizable: params.minimizable ?? true,
        resizable: params.resizable ?? true,
        movable: params.movable ?? true,
        unique: params.unique ?? false,
        titleBar: params.titleBar ?? true,
        initialStatus,
        windowStatus: {
          isMoving: false,
          isResizing: false,
          isMaximized: initialStatus.isMaximized ?? false,
          isMinimized: initialStatus.isMinimized ?? false,
          isFocused: initialStatus.isFocused ?? true,
          width,
          height,
          left,
          top
        },
        originalContainerSize: state.containerSize
      }

      const blurred = state.windows.map((window) => ({
        ...window,
        windowStatus: {
          ...window.windowStatus,
          isFocused: false
        }
      }))

      return {
        ...state,
        windows: [...blurred, nextWindow]
      }
    })

    return id
  },

  mouseCapture: (event) => {
    const { movementX, movementY } = event

    if (!movementX && !movementY) {
      return
    }

    const { containerSize } = get()

    set((state) => {
      const movingWindow = state.windows.find((window) => window.windowStatus.isMoving)
      const resizingWindow = state.windows.find((window) => window.windowStatus.isResizing)

      if (!movingWindow && !resizingWindow) {
        return state
      }

      return {
        ...state,
        windows: state.windows.map((window) => {
          if (movingWindow && window.id === movingWindow.id) {
            const nextLeft = clamp(
              window.windowStatus.left + movementX,
              0,
              Math.max(0, containerSize.width - window.windowStatus.width)
            )
            const nextTop = clamp(
              window.windowStatus.top + movementY,
              0,
              Math.max(0, containerSize.height - window.windowStatus.height)
            )

            return {
              ...window,
              windowStatus: {
                ...window.windowStatus,
                left: nextLeft,
                top: nextTop
              }
            }
          }

          if (resizingWindow && window.id === resizingWindow.id) {
            const maxWidth = Math.max(MIN_WINDOW_WIDTH, containerSize.width - window.windowStatus.left)
            const maxHeight = Math.max(
              MIN_WINDOW_HEIGHT,
              containerSize.height - window.windowStatus.top
            )

            const nextWidth = clamp(window.windowStatus.width + movementX, MIN_WINDOW_WIDTH, maxWidth)
            const nextHeight = clamp(
              window.windowStatus.height + movementY,
              MIN_WINDOW_HEIGHT,
              maxHeight
            )

            return {
              ...window,
              windowStatus: {
                ...window.windowStatus,
                width: nextWidth,
                height: nextHeight
              }
            }
          }

          return window
        })
      }
    })
  },

  removeMovingResizing: () => {
    set((state) => ({
      ...state,
      windows: state.windows.map((window) => ({
        ...window,
        windowStatus: {
          ...window.windowStatus,
          isMoving: false,
          isResizing: false
        }
      }))
    }))
  },

  clearWindows: () => {
    set((state) => ({ ...state, windows: [] }))
  }
}))
