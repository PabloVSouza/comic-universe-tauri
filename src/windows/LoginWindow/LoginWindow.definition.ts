import { WindowDefinition } from '@pablovsouza/react-window-manager'
import { LoginWindow, LoginWindowProps } from './LoginWindow'

export const loginWindowDefinition: WindowDefinition<LoginWindowProps> = {
  component: LoginWindow,
  windowProps: {
    title: 'Login',
    overlay: true,
    unique: true,
    closeable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    titleBar: false,
    contentClassName: 'h-full w-full flex items-center justify-center'
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
          width: '60%',
          height: '80%'
        }
}
