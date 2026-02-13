import { WindowDefinition } from '@pablovsouza/react-window-manager'
import { RegisterWindow, RegisterWindowProps } from './RegisterWindow'

export const registerWindowDefinition: WindowDefinition<RegisterWindowProps> = {
  component: RegisterWindow,
  windowProps: {
    title: 'Register',
    overlay: true,
    unique: true,
    closeable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    titleBar: false,
    contentClassName: 'h-full w-full'
  },
  initialStatus: ({ isMobile }) =>
    isMobile
      ? {
          startPosition: 'topLeft',
          positionAnchor: 'startPosition',
          width: '100%',
          height: '100%'
        }
      : {
          startPosition: 'center',
          positionAnchor: 'startPosition',
          width: '48%',
          height: 'auto'
        }
}
