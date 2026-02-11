import type { ComponentType } from 'react'
import type { WindowCreateParams, WindowInitialStatus } from './types'

export type WindowModuleProps = Omit<WindowCreateParams, 'id' | 'content' | 'initialStatus'>

export type WindowModule<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  windowProps: WindowModuleProps
  initialStatus: WindowInitialStatus
} & {
  [componentName: string]: ComponentType<TProps> | WindowModuleProps | WindowInitialStatus
}
