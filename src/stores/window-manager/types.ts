import type { ReactNode } from 'react'
import type { HtmlPortalNode } from 'react-reverse-portal'

export type WindowStartPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export type WindowMeasure = number | string

export type WindowInitialStatus = {
  isMaximized?: boolean
  isMinimized?: boolean
  isFocused?: boolean
  width?: WindowMeasure
  height?: WindowMeasure
  left?: WindowMeasure
  top?: WindowMeasure
  startPosition?: WindowStartPosition
}

export type WindowCreateParams = {
  id?: string
  title?: string
  content: ReactNode
  closeable?: boolean
  className?: string
  contentClassName?: string
  maximizable?: boolean
  minimizable?: boolean
  resizable?: boolean
  movable?: boolean
  unique?: boolean
  titleBar?: boolean
  initialStatus?: WindowInitialStatus
}

export type WindowStatus = {
  isMoving: boolean
  isResizing: boolean
  isMaximized: boolean
  isMinimized: boolean
  isFocused: boolean
  width: number
  height: number
  left: number
  top: number
}

export type WindowInstance = {
  id: string
  title?: string
  content: ReactNode
  portalNode: HtmlPortalNode
  closeable: boolean
  className?: string
  contentClassName?: string
  maximizable: boolean
  minimizable: boolean
  resizable: boolean
  movable: boolean
  unique: boolean
  titleBar: boolean
  initialStatus: WindowInitialStatus & { startPosition: WindowStartPosition }
  windowStatus: WindowStatus
  originalContainerSize?: { width: number; height: number }
  restoreStatus?: Pick<WindowStatus, 'width' | 'height' | 'left' | 'top'>
}

export type WindowManagerStore = {
  windows: WindowInstance[]
  containerSize: { width: number; height: number }
  setContainerSize: (size: { width: number; height: number }) => void
  mouseCapture: (event: { movementX: number; movementY: number }) => void
  removeMovingResizing: () => void
  openWindow: (params: WindowCreateParams) => string
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  setWindowMinimized: (id: string, minimized: boolean) => void
  setWindowMaximized: (id: string, maximized: boolean) => void
  setWindowMoving: (id: string, moving: boolean) => void
  setWindowResizing: (id: string, resizing: boolean) => void
  updateWindow: (id: string, patch: Partial<WindowCreateParams>) => void
  clearWindows: () => void
}
