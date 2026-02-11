import type { WindowModule } from 'stores/window-manager'

type TestWindowProps = {
  message?: string
}

export function TestWindow({ message }: TestWindowProps) {
  const startedAt = new Date().toLocaleString()

  return (
    <div className="space-y-3 p-4 text-sm">
      <h2 className="text-base font-semibold">Window Provider Test</h2>
      <p>{message || 'This is a test window rendered by the provider-based window manager.'}</p>
      <p className="text-muted-foreground">Opened at: {startedAt}</p>
    </div>
  )
}

const testWindowModule: WindowModule<TestWindowProps> = {
  TestWindow,
  windowProps: {
    contentClassName: 'h-full w-full',
    closeable: true,
    minimizable: false,
    titleBar: false,
    unique: true,
    title: 'Test Window'
  },
  initialStatus: {
    startPosition: 'center',
    width: 640,
    height: 420
  }
}

export default testWindowModule
