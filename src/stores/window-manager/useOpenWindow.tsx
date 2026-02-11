import { createElement, useCallback, type ComponentType } from 'react'
import * as WindowList from 'windows'
import { useWindowManagerStore } from './useWindowManagerStore'
import type { WindowModule } from './windowModuleTypes'

type OpenWindowParams = {
  component: string
  props?: Record<string, unknown>
}

export function useOpenWindow() {
  const openWindow = useWindowManagerStore((state) => state.openWindow)

  return useCallback(
    ({ component, props = {} }: OpenWindowParams) => {
      const selectedWindow = WindowList[component as keyof typeof WindowList] as
        | WindowModule
        | undefined

      if (!selectedWindow) {
        return
      }

      const Component = selectedWindow[component]
      const windowProps = selectedWindow.windowProps || {}
      const initialStatus = selectedWindow.initialStatus || {}

      if (typeof Component !== 'function') {
        return
      }

      openWindow({
        ...windowProps,
        id: windowProps.unique ? component : undefined,
        initialStatus,
        content: createElement(Component as ComponentType<Record<string, unknown>>, props)
      })
    },
    [openWindow]
  )
}
