import { getCurrentWindow } from '@tauri-apps/api/window'

export type WindowActionHandle = {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  hide: () => Promise<void>
  show: () => Promise<void>
  unminimize: () => Promise<void>
  close: () => Promise<void>
}

export const withCurrentWindow = async (
  callback: (window: WindowActionHandle) => Promise<void>
) => {
  try {
    await callback(getCurrentWindow())
  } catch (error) {
    console.error('[WindowActions] Failed to execute window action', error)
  }
}
