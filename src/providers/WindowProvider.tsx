import { createContext, type ReactNode, useContext } from 'react'
import { WindowManager } from 'components/WindowComponents/WindowManager'
import { useWindowManagerStore } from 'stores/window-manager'
import type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore,
  WindowStartPosition,
  WindowStatus
} from 'stores/window-manager'

const WindowManagerContext = createContext<WindowManagerStore | null>(null)

export function WindowProvider({ children }: { children: ReactNode }) {
  const manager = useWindowManagerStore()

  return (
    <WindowManagerContext.Provider value={manager}>
      {children}
      <WindowManager />
    </WindowManagerContext.Provider>
  )
}

export function useWindowManager() {
  const context = useContext(WindowManagerContext)

  if (!context) {
    throw new Error('useWindowManager must be used within a WindowProvider')
  }

  return context
}

export type {
  WindowCreateParams,
  WindowInitialStatus,
  WindowInstance,
  WindowManagerStore as WindowManagerContextValue,
  WindowStartPosition,
  WindowStatus
}
