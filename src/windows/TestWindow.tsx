import { useMemo, useRef, useState } from 'react'
import {
  useKeyboardShortcuts,
  type WindowDefinition
} from '@pablovsouza/react-window-manager'

type TestWindowProps = {
  message?: string
  windowId?: string
  closeSelf?: () => void
}

export function TestWindow({ message, windowId, closeSelf }: TestWindowProps) {
  const [rightArrowCount, setRightArrowCount] = useState(0)
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
    </div>
  )
}

export const testWindowDefinition: WindowDefinition<TestWindowProps> = {
  component: TestWindow,
  windowProps: {
    contentClassName: 'h-full w-full',

    title: 'Test Window'
  },
  initialStatus: {
    startPosition: 'center',
    width: 640,
    height: 420
  }
}

export default testWindowDefinition
