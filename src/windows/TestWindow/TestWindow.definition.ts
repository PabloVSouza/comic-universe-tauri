import { WindowDefinition } from '@pablovsouza/react-window-manager'
import { TestWindow, TestWindowProps } from './TestWindow'

export const testWindowDefinition: WindowDefinition<TestWindowProps> = {
  component: TestWindow,
  windowProps: {
    contentClassName: 'h-full w-full',
    title: 'Test Window',
    overlay: true
  },
  initialStatus: {
    startPosition: 'center',
    width: 640,
    height: 420
  }
}
