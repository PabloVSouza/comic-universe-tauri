import { FC, useMemo, useRef, useState } from 'react'
import { useKeyboardShortcuts, useOpenWindow } from '@pablovsouza/react-window-manager'
import { Button } from '@/components'

export type TestWindowProps = {
  message?: string
  windowId?: string
  closeSelf?: () => void
}

export const TestWindow: FC<TestWindowProps> = ({ message, windowId, closeSelf }) => {
  const [rightArrowCount, setRightArrowCount] = useState(0)
  const openWindow = useOpenWindow()
  const startedAtRef = useRef(new Date().toLocaleString())

  const shortcuts = useMemo(
    () => [
      {
        key: 'Escape',
        preventDefault: true,
        handler: () => {
          closeSelf?.()
          return true
        }
      },
      {
        key: 'ArrowRight',
        handler: () => {
          setRightArrowCount((value) => value + 1)
        }
      }
    ],
    [closeSelf, windowId]
  )

  useKeyboardShortcuts({
    shortcuts
  })

  return (
    <div className="space-y-3 p-4 text-sm">
      <h2 className="text-base font-semibold">Window Provider Test</h2>
      <p>{message || 'This is a test window rendered by the provider-based window manager.'}</p>
      <p className="text-muted-foreground">Opened at: {startedAtRef.current}</p>
      <p className="text-muted-foreground">ArrowRight presses: {rightArrowCount}</p>
      <p className="text-muted-foreground">
        Try `ArrowRight` and `Escape` while this window is focused.
      </p>
      <Button onClick={() => openWindow({ component: 'TestWindow2' })}>Open Window</Button>
    </div>
  )
}
